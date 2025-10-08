import os
import json
import re
from typing import Dict, Optional, List
import PyPDF2
import fitz
import google.generativeai as genai
from pathlib import Path
import logging
from dataclasses import dataclass
from config import Config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ASDParameters:
    deposited_material: str = "Not specified"
    element: str = "Not specified"
    deposition_technique: str = "Not specified"
    precursor: str = "Not specified"
    coreactant: str = "Not specified"
    surface_substrate: str = "Not specified"
    surface_pretreatment: str = "Not specified"
    title: str = "Not specified"
    authors: List[str] = None
    journal: str = "Not specified"
    journal_full: str = "Not specified"
    year: str = "Not specified"
    volume: str = "Not specified"
    issue: str = "Not specified"
    pages: str = "Not specified"
    doi: str = "Not specified"
    confidence: str = "low"

    def __post_init__(self):
        if self.authors is None:
            self.authors = []

class PDFTextExtractor:
    """Handles PDF text extraction with multiple fallback methods"""
    
    @staticmethod
    def extract_with_pymupdf(pdf_path: str) -> str:
        """Extract text using PyMuPDF (recommended for research papers)"""
        try:
            doc = fitz.open(pdf_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text
        except Exception as e:
            logger.error(f"PyMuPDF extraction failed: {e}")
            return ""
    
    @staticmethod
    def extract_with_pypdf2(pdf_path: str) -> str:
        """Fallback extraction using PyPDF2"""
        try:
            with open(pdf_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                text = ""
                for page in reader.pages:
                    text += page.extract_text()
            return text
        except Exception as e:
            logger.error(f"PyPDF2 extraction failed: {e}")
            return ""
    
    def extract_text(self, pdf_path: str) -> str:
        """Extract text with fallback methods"""
        logger.info(f"Extracting text from: {pdf_path}")
        
        text = self.extract_with_pymupdf(pdf_path)
        
        if not text.strip():
            logger.warning("PyMuPDF failed, trying PyPDF2...")
            text = self.extract_with_pypdf2(pdf_path)
        
        if not text.strip():
            raise ValueError("Failed to extract text from PDF")
        
        logger.info(f"Extracted {len(text)} characters")
        return text

class TextPreprocessor:
    """Handles text preprocessing and filtering"""
    
    def __init__(self):
        self.asd_keywords = [
            'area selective', 'area-selective', 'selective deposition', 
            'selective growth', 'ALD', 'CVD', 'atomic layer deposition',
            'chemical vapor deposition', 'precursor', 'substrate', 
            'surface treatment', 'deposition'
        ]
        
        # Section headers to prioritize
        self.priority_sections = [
            'abstract', 'introduction', 'experimental', 'methods',
            'materials', 'results', 'synthesis', 'deposition',
            'sample preparation', 'surface preparation'
        ]
    
    def clean_text(self, text: str) -> str:
        """Basic text cleaning"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove page numbers and headers/footers patterns
        text = re.sub(r'\n\d+\s*\n', '\n', text)
        text = re.sub(r'\n[A-Za-z\s]+\|\s*Page\s*\d+', '', text)
        
        # Remove reference citations like [1], [23], etc.
        text = re.sub(r'\[\d+(?:,\s*\d+)*\]', '', text)
        
        # Remove figure/table references
        text = re.sub(r'Fig\.?\s*\d+[a-z]?', 'Figure', text, flags=re.IGNORECASE)
        text = re.sub(r'Table\s*\d+', 'Table', text, flags=re.IGNORECASE)
        
        return text.strip()
    
    def extract_relevant_sections(self, text: str) -> str:
        """Extract sections most likely to contain ASD parameters"""
        sections = []
        current_section = ""
        lines = text.split('\n')
        
        for line in lines:
            line_lower = line.lower()
            
            # Check if line is a section header
            is_section_header = any(keyword in line_lower for keyword in self.priority_sections)
            
            if is_section_header and len(line.split()) < 10:  # Likely a header
                if current_section:
                    sections.append(current_section)
                current_section = line + "\n"
            else:
                current_section += line + "\n"
        
        if current_section:
            sections.append(current_section)
        
        return '\n'.join(sections)
    
    def filter_by_keywords(self, text: str, max_chars: int = 50000) -> str:
        """Filter text by ASD-related keywords and limit size"""
        paragraphs = text.split('\n\n')
        relevant_paragraphs = []
        char_count = 0
        
        for paragraph in paragraphs:
            if char_count >= max_chars:
                break
                
            paragraph_lower = paragraph.lower()
            
            # Check if paragraph contains ASD-related keywords
            if any(keyword in paragraph_lower for keyword in self.asd_keywords):
                relevant_paragraphs.append(paragraph)
                char_count += len(paragraph)
        
        # If no relevant paragraphs found, return beginning of text
        if not relevant_paragraphs:
            logger.warning("No ASD-related keywords found, using first portion of text")
            return text[:max_chars]
        
        return '\n\n'.join(relevant_paragraphs)
    
    def preprocess(self, text: str) -> str:
        """Complete preprocessing pipeline"""
        logger.info("Starting text preprocessing...")
        
        # Step 1: Clean text
        text = self.clean_text(text)
        logger.info(f"After cleaning: {len(text)} characters")
        
        # Step 2: Extract relevant sections
        text = self.extract_relevant_sections(text)
        logger.info(f"After section extraction: {len(text)} characters")
        
        # Step 3: Filter by keywords and limit size
        text = self.filter_by_keywords(text, max_chars=45000)  # Leave room for prompt
        logger.info(f"After keyword filtering: {len(text)} characters")
        
        return text

class GeminiASDExtractor:
    """Handles interaction with Google Gemini API"""
    
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash')
        
        self.prompt = self.prompt = """Extract Area Selective Deposition parameters AND complete bibliographic information from this research paper. Return ONLY explicitly stated information.

Extract These 16 Parameters:

**Deposition Parameters:**
1. **Deposited Material** - Target material (ZnO, TiO2, Al2O3, etc.)
2. **Element** - Primary element from material formula (Zn, Ti, Al, etc.)
3. **Deposition Technique** - Method used (ALD, CVD, PECVD, MLD, etc.)
4. **Precursor** - Source compound used for deposition
5. **Coreactant** - Reactive species (H2O, O2, NH3, plasma, etc.)
6. **Surface/Substrate** - Base material (Si, SiO2, glass, metal, etc.)
7. **Surface Pretreatment** - Cleaning/treatment before deposition

**Bibliographic Information:**
8. **Title** - Full paper title
9. **Authors** - ALL authors as array (e.g., ["Smith, J.", "Doe, A.", "Johnson, B."])
10. **Journal** - Abbreviated journal name (e.g., "ACS Nano")
11. **Journal Full** - Full journal name (e.g., "ACS Nano - American Chemical Society")
12. **Year** - Publication year
13. **Volume** - Journal volume number
14. **Issue** - Journal issue number
15. **Pages** - Page range (e.g., "1234-1245")
16. **DOI** - Digital Object Identifier

Search Locations: 
- Title/Abstract for bibliographic info
- Methods/Experimental for deposition parameters
- Results, Tables, Figure captions for details
- First page/header for journal info

Common Terms:
- ASD: "selective deposition", "area-selective growth"
- Precursor: "metal source", "organometalical", "source material"
- Surface treatment: "surface prep", "cleaning", "activation"
- Authors: Look for "by", "authored by", or author list format

Output Format (JSON only):
{
  "deposited_material": "value or Not specified",
  "element": "value or Not specified", 
  "deposition_technique": "value or Not specified",
  "precursor": "value or Not specified",
  "coreactant": "value or Not specified",
  "surface_substrate": "value or Not specified",
  "surface_pretreatment": "value or Not specified",
  "title": "value or Not specified",
  "authors": ["Author1", "Author2", "Author3"] or [],
  "journal": "value or Not specified",
  "journal_full": "value or Not specified",
  "year": "value or Not specified",
  "volume": "value or Not specified",
  "issue": "value or Not specified",
  "pages": "value or Not specified",
  "doi": "value or Not specified",
  "confidence": "high/medium/low"
}

IMPORTANT: 
- Extract ALL authors, not just the first one
- Authors should be in format: "LastName, FirstInitial."
- If multiple experiments exist, extract from the primary/main one
- Mark unclear info as "Not specified"
- For authors array, return empty array [] if not found, not "Not specified"

Research Paper Content:
"""
    
    def extract_parameters(self, text: str) -> ASDParameters:
        """Extract ASD parameters using Gemini"""
        try:
            logger.info("Sending request to Gemini API...")
            
            # Combine prompt with text
            full_prompt = self.prompt + text
            
            # Generate response
            response = self.model.generate_content(full_prompt)
            response_text = response.text
            
            logger.info("Received response from Gemini")
            
            # Parse JSON response
            return self._parse_response(response_text)
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return ASDParameters()
    
    def _parse_response(self, response_text: str) -> ASDParameters:
        """Parse JSON response from Gemini"""
        try:
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                data = json.loads(json_str)
                
                authors = data.get('authors', [])
                if isinstance(authors, str):
                    authors = [authors] if authors != "Not specified" else []
                elif not isinstance(authors, list):
                    authors = []
                
                return ASDParameters(
                    deposited_material=data.get('deposited_material', 'Not specified'),
                    element=data.get('element', 'Not specified'),
                    deposition_technique=data.get('deposition_technique', 'Not specified'),
                    precursor=data.get('precursor', 'Not specified'),
                    coreactant=data.get('coreactant', 'Not specified'),
                    surface_substrate=data.get('surface_substrate', 'Not specified'),
                    surface_pretreatment=data.get('surface_pretreatment', 'Not specified'),
                    title=data.get('title', 'Not specified'),
                    authors=authors,
                    journal=data.get('journal', 'Not specified'),
                    journal_full=data.get('journal_full', 'Not specified'),
                    year=data.get('year', 'Not specified'),
                    volume=data.get('volume', 'Not specified'),
                    issue=data.get('issue', 'Not specified'),
                    pages=data.get('pages', 'Not specified'),
                    doi=data.get('doi', 'Not specified'),
                    confidence=data.get('confidence', 'low')
                )
            else:
                raise ValueError("No JSON found in response")
            
        except Exception as e:
            logger.error(f"Failed to parse response: {e}")
            logger.error(f"Raw response: {response_text}")
            return ASDParameters()

class ASDParameterExtractor:
    """Main class that orchestrates the extraction process"""
    
    def __init__(self, gemini_api_key: str):
        self.pdf_extractor = PDFTextExtractor()
        self.preprocessor = TextPreprocessor()
        self.gemini_extractor = GeminiASDExtractor(gemini_api_key)
    
    def extract_from_pdf(self, pdf_path: str) -> Dict:
        """Main method to extract ASD parameters from PDF"""
        try:
            logger.info(f"Starting extraction for: {pdf_path}")
            
            # Step 1: Extract text from PDF
            raw_text = self.pdf_extractor.extract_text(pdf_path)
            
            # Step 2: Preprocess text
            processed_text = self.preprocessor.preprocess(raw_text)
            
            # Step 3: Extract parameters using Gemini
            parameters = self.gemini_extractor.extract_parameters(processed_text)
            
            # Convert to dictionary for easy serialization
            result = {
                'pdf_file': os.path.basename(pdf_path),
                'deposited_material': parameters.deposited_material,
                'element': parameters.element,
                'deposition_technique': parameters.deposition_technique,
                'precursor': parameters.precursor,
                'coreactant': parameters.coreactant,
                'surface_substrate': parameters.surface_substrate,
                'surface_pretreatment': parameters.surface_pretreatment,
                'title': parameters.title,
                'authors': parameters.authors,
                'journal': parameters.journal,
                'journal_full': parameters.journal_full,
                'year': parameters.year,
                'volume': parameters.volume,
                'issue': parameters.issue,
                'pages': parameters.pages,
                'doi': parameters.doi,
                'confidence': parameters.confidence,
                'text_length': len(processed_text),
                'status': 'success'
            }
            
            logger.info("Extraction completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Extraction failed: {e}")
            return {
                'pdf_file': os.path.basename(pdf_path) if pdf_path else 'unknown',
                'status': 'error',
                'error': str(e)
            }

def main():
    """Example usage"""
    # Configuration
    GEMINI_API_KEY = Config.GEMINI_API_KEY
    PDF_PATH = "LLM Training/Park et al 2006 Full Paper.pdf"
    
    extractor = ASDParameterExtractor(GEMINI_API_KEY)
    
    result = extractor.extract_from_pdf(PDF_PATH)
    
    print(json.dumps(result, indent=2))
    
    with open('extraction_result.json', 'w') as f:
        json.dump(result, f, indent=2)

if __name__ == "__main__":
    main()