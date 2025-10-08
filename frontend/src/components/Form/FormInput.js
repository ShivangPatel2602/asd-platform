import { useState } from "react";
import LabeledInput from "./LabeledInput";
import Navbar from "../Navbar/Navbar";
import { submitFormData } from "../../services/api";
import SurfaceReadingsInput from "./SurfaceReadings";
import AuthorsInput from "./AuthorsInput";
import PDFUploader from "../PDFUploader/PDFUploader";
import "./FormInput.css";

const FormInput = ({ setUser, user, isAuthorized }) => {
  const [form, setForm] = useState({
    element: "",
    material: "",
    technique: "",
    precursor: "",
    coreactant: "",
    temperature: "",
    publication: {
      authors: [""],
      title: "",
      journal: "",
      journal_full: "",
      year: "",
      volume: "",
      issue: "",
      pages: "",
      doi: "",
    },
  });

  const [surfaces, setSurfaces] = useState([
    {
      surface: "",
      pretreatment: "",
      rawData: "",
    },
  ]);

  const [status, setStatus] = useState("");
  const [isPDFLoading, setIsPDFLoading] = useState(false);
  const [extractionConfidence, setExtractionConfidence] = useState(null);

  const sections = [
    {
      title: "Material Information",
      fields: [
        { id: "element", label: "Element", icon: "⚛️" },
        { id: "material", label: "Material", icon: "🧪" },
        { id: "technique", label: "Technique of Deposition", icon: "🔧" },
      ],
    },
    {
      title: "Process Parameters",
      fields: [
        { id: "precursor", label: "Precursor", icon: "🔄" },
        { id: "coreactant", label: "Co-reactant", icon: "⚡" },
        {
          id: "temperature",
          label: "Temperature (°C)",
          type: "number",
          icon: "🌡️",
        },
      ],
    },
    {
      title: "Publication Details",
      fields: [
        {
          id: "publication.title",
          label: "Paper Title",
          icon: "📄",
          placeholder: "e.g., Area-Selective Atomic Layer Deposition...",
        },
        {
          id: "publication.journal",
          label: "Journal Abbreviation",
          icon: "📰",
          placeholder: "e.g., ACS Nano",
        },
        {
          id: "publication.journal_full",
          label: "Full Journal Name",
          icon: "📚",
          placeholder: "e.g., ACS Nano - American Chemical Society",
        },
        {
          id: "publication.year",
          label: "Publication Year",
          icon: "📅",
          type: "number",
          placeholder: "e.g., 2023",
        },
        {
          id: "publication.volume",
          label: "Volume",
          icon: "📖",
          placeholder: "e.g., 15",
        },
        {
          id: "publication.issue",
          label: "Issue",
          icon: "🔢",
          placeholder: "e.g., 3",
        },
        {
          id: "publication.pages",
          label: "Page Numbers",
          icon: "📃",
          placeholder: "e.g., 1234-1245",
        },
        {
          id: "publication.doi",
          label: "DOI",
          icon: "🔗",
          placeholder: "e.g., 10.1021/example",
        },
      ],
    },
  ];

  const handlePDFDataExtracted = (extractedData, confidence) => {
    setForm((prev) => ({
      ...prev,
      element: extractedData.element || prev.element,
      material: extractedData.material || prev.material,
      technique: extractedData.technique || prev.technique,
      precursor: extractedData.precursor || prev.precursor,
      coreactant: extractedData.coreactant || prev.coreactant,
      publication: {
        ...prev.publication,
        title: extractedData.title || prev.publication.title,
        journal: extractedData.journal || prev.publication.journal,
        journal_full:
          extractedData.journal_full || prev.publication.journal_full,
        year: extractedData.year || prev.publication.year,
        volume: extractedData.volume || prev.publication.volume,
        issue: extractedData.issue || prev.publication.issue,
        pages: extractedData.pages || prev.publication.pages,
        doi: extractedData.doi || prev.publication.doi,
        authors:
          extractedData.authors && extractedData.authors.length > 0
            ? extractedData.authors
            : prev.publication.authors,
      },
    }));

    if (extractedData.surface || extractedData.pretreatment) {
      setSurfaces([
        {
          surface: extractedData.surface || "",
          pretreatment: extractedData.pretreatment || "",
          rawData: "",
        },
      ]);
    }

    setExtractionConfidence(confidence);
    setStatus(
      `PDF data extracted successfully! Confidence: ${confidence}. Please review and complete the form.`
    );
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    if (id.includes(".")) {
      const [parent, child] = id.split(".");
      setForm((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [id]: value,
      }));
    }
  };

  const handleSurfaceAdd = () => {
    setSurfaces([
      ...surfaces,
      {
        surface: "",
        pretreatment: "",
        rawData: "",
      },
    ]);
  };

  const handleSurfaceRemove = (index) => {
    setSurfaces(surfaces.filter((_, i) => i !== index));
  };

  const handleSurfaceDataChange = (index, field, value) => {
    const newSurfaces = [...surfaces];
    newSurfaces[index][field] = value;
    setSurfaces(newSurfaces);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.publication.authors.some((author) => author.trim()) ||
      !form.publication.journal ||
      !form.publication.year ||
      !form.publication.title
    ) {
      setStatus(
        "Please fill in at least: one author, title, journal, and year"
      );
      return;
    }

    const year = parseInt(form.publication.year);
    if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
      setStatus("Please enter a valid publication year");
      return;
    }

    try {
      for (const surfaceData of surfaces) {
        const readings = surfaceData.rawData
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) => {
            const [cycle, thickness] = line.split(/\t|,|\s+/);
            return {
              cycles: parseFloat(cycle),
              thickness: parseFloat(thickness),
            };
          })
          .filter(
            (reading) => !isNaN(reading.cycles) && !isNaN(reading.thickness)
          );

        const submission = {
          ...form,
          surface: surfaceData.surface,
          pretreatment: surfaceData.pretreatment,
          readings,
        };

        await submitFormData(submission, user);
      }

      setStatus("All data saved successfully!");
      setSurfaces([{ surface: "", pretreatment: "", rawData: "" }]);
      setForm({
        element: "",
        material: "",
        technique: "",
        precursor: "",
        coreactant: "",
        temperature: "",
        publication: {
          authors: [""],
          title: "",
          journal: "",
          journal_full: "",
          year: "",
          volume: "",
          issue: "",
          pages: "",
          doi: "",
        },
      });
    } catch (error) {
      setStatus("Failed to save data");
      console.error("Error submitting data:", error);
    }
  };

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} />
      <div className="form-page">
        <h1 className="form-title">Submit New Data</h1>
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-sections">
            <h2 className="section-title">
              <span className="field-icon">🤖</span>
              AI-Assisted Data Extraction
            </h2>
            <PDFUploader
              onDataExtracted={handlePDFDataExtracted}
              isLoading={isPDFLoading}
              setIsLoading={setIsPDFLoading}
            />
            {extractionConfidence && (
              <div
                className={`confidence-indicator confidence-${extractionConfidence}`}
              >
                Extraction Confidence: {extractionConfidence.toUpperCase()}
              </div>
            )}

            {/* First row: Material Information + Process Parameters - NOW DYNAMIC */}
            <div className="form-sections-row">
              {sections.slice(0, 2).map((section, sectionIndex) => (
                <div key={sectionIndex} className="form-section">
                  <h2 className="section-title">{section.title}</h2>
                  <div className="section-fields">
                    {section.fields.map((field) => (
                      <div key={field.id} className="field-container">
                        <span className="field-icon">{field.icon}</span>
                        <LabeledInput
                          id={field.id}
                          label={field.label}
                          type={field.type || "text"}
                          value={form[field.id] || ""}
                          onChange={handleChange}
                          placeholder={field.placeholder || ""}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Second row: Publication Details + Authors - NOW DYNAMIC */}
            <div className="form-sections-row">
              <div className="form-section">
                <h2 className="section-title">Publication Details</h2>
                <div className="section-fields">
                  {sections[2].fields.map((field) => (
                    <div
                      key={field.id}
                      className={`field-container ${
                        field.id === "publication.title" ||
                        field.id === "publication.doi" ||
                        field.id === "publication.journal_full"
                          ? "full-width"
                          : ""
                      }`}
                    >
                      <span className="field-icon">{field.icon}</span>
                      <LabeledInput
                        id={field.id}
                        label={field.label}
                        type={field.type || "text"}
                        value={field.id
                          .split(".")
                          .reduce((obj, key) => obj[key], form)}
                        onChange={handleChange}
                        placeholder={field.placeholder || ""}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h2 className="section-title">
                  <span className="field-icon">👤</span>
                  Authors
                </h2>
                <AuthorsInput
                  authors={form.publication.authors || [""]}
                  onAuthorsChange={(authors) =>
                    setForm((prev) => ({
                      ...prev,
                      publication: {
                        ...prev.publication,
                        authors,
                      },
                    }))
                  }
                />
              </div>
            </div>

            {/* Full width: Surface Details - NO CHANGES NEEDED */}
            <div className="form-section">
              <h2 className="section-title">
                <span className="field-icon">📊</span>
                Surface Details and Measurements
              </h2>
              <SurfaceReadingsInput
                surfaces={surfaces}
                onSurfaceAdd={handleSurfaceAdd}
                onSurfaceRemove={handleSurfaceRemove}
                onDataChange={handleSurfaceDataChange}
              />
            </div>
          </div>

          <button type="submit" className="submit-btn">
            <span className="button-icon">💾</span>
            Submit Data
          </button>

          {status && (
            <div
              className={`status-message ${
                status.includes("success") ? "success" : "error"
              }`}
            >
              {status}
            </div>
          )}
        </form>
      </div>
    </>
  );
};

export default FormInput;
