from flask import Flask, jsonify, request, redirect, session
from authlib.integrations.flask_client import OAuth
from flask_cors import CORS
from pymongo import MongoClient
from config import Config
from flask_mail import Mail, Message
from datetime import datetime, timedelta
from bson.objectid import ObjectId
import json
import requests
import numpy as np
from vectorized_combination import run_an_model
import traceback
import os
from werkzeug.utils import secure_filename
import tempfile
from script import ASDParameterExtractor
import google.generativeai as genai

app = Flask(__name__)
app.secret_key = 'super_secret_dev_key'
CORS(
    app, 
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:3000",
                "https://asd-platform-frontend.onrender.com"        
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "Accept", "Origin"],
            "expose_headers": ["Content-Range", "X-Content-Range"],
            "supports_credentials": True,
            "send_wildcard": False,
            "max_age": 86400
        }
    },
    supports_credentials=True
)

@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        headers = response.headers

        origin = request.headers.get("Origin")
        if origin:
            headers["Access-Control-Allow-Origin"] = origin

        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Headers"] = request.headers.get(
            "Access-Control-Request-Headers", "Content-Type,Authorization"
        )
        headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS,PUT,DELETE"
        return response


app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='None',
    SESSION_COOKIE_DOMAIN=None,
    PERMANENT_SESSION_LIFETIME=timedelta(days=7)
)

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = Config.ADMIN_EMAIL
app.config['MAIL_PASSWORD'] = Config.EMAIL_PASSWORD
mail = Mail(app)

client = MongoClient(Config.MONGO_URL)

db = client.get_database(Config.DB_NAME)
collection = db["asd-platform"]
access_collection = db["access-requests"]
approved_users = db["approved-users"]
pending_submissions = db["pending-submissions"]
authorized_users = db["authorized-users"]

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "Backend is running"}), 200

@app.route("/api/request-access", methods=["POST"])
def request_access():
    data = request.get_json()
    
    existing_request = access_collection.find_one({"email": data["email"]})
    if existing_request:
        return jsonify({"message": "Request already submitted"}), 400
    
    access_collection.insert_one({
        "name": data["name"],
        "email": data["email"],
        "university": data["university"],
        "department": data["department"],
        "purpose": data["purpose"],
        "status": data["status"],
        "request_date": datetime.now(),
        "approved": False
    })
    
    admin_msg = Message(
        'New Access Request - ASD Platform',
        sender=Config.ADMIN_EMAIL,
        recipients=[Config.ADMIN_EMAIL]
    )
    admin_msg.html = f"""
        <h3>New Access Request</h3>
        <p><strong>Name:</strong> {data['name']}</p>
        <p><strong>Email:</strong> {data['email']}</p>
        <p><strong>University:</strong> {data['university']}</p>
        <p><strong>Department:</strong> {data['department']}</p>
        <p><strong>Status:</strong> {data['status']}</p>
        <p><strong>Purpose:</strong> {data['purpose']}</p>
        <a href="{Config.BACKEND_URL}/api/approve-access/{data['email']}">Click here to approve</a>
    """
    mail.send(admin_msg)
    
    return jsonify({"message": "Request submitted successfully"}), 200

@app.route("/api/approve-access/<email>")
def approve_access(email):
    access_collection.update_one(
        {"email": email},
        {"$set": {"approved": True}}
    )
    approved_users.insert_one({
        "email": email,
        "approved_date": datetime.now()
    })
    user_msg = Message(
        'Access Approved - ASD Platform',
        sender=Config.ADMIN_EMAIL,
        recipients=[email]
    )
    user_msg.html = """
        <h3>Access Approved</h3>
        <p>Your request to access the ASD Platform has been approved.</p>
        <p>You can now log in using Google Sign-in.</p>
    """
    mail.send(user_msg)
    
    return "Access approved successfully"

@app.route("/api/check-access")
def check_access():
    email = request.args.get("email")
    user = approved_users.find_one({"email": email})
    return jsonify({"hasAccess": bool(user)})

oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=Config.GOOGLE_CLIENT_ID,
    client_secret=Config.GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

@app.route("/api/auth/google")
def login():
    redirect_uri = f"{Config.BACKEND_URL}/api/auth/google/callback"
    return google.authorize_redirect(redirect_uri)

@app.route('/api/auth/google/callback')
def auth_callback():
    token = google.authorize_access_token()
    user_info = google.get('https://www.googleapis.com/oauth2/v2/userinfo').json()
    approved_user = approved_users.find_one({"email": user_info["email"]})
    if not approved_user:
        return redirect(f"{Config.FRONTEND_URL}/#/?error=not_approved")
    session.permanent = True
    session['user'] = user_info
    return redirect(f"{Config.FRONTEND_URL}/#/dashboard")

@app.route('/api/user')
def get_user():
    user = session.get('user')
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    approved_user = approved_users.find_one({"email": user["email"]})
    if not approved_user:
        session.clear()
        return jsonify({"error": "Not approved"}), 403
    is_authorized = authorized_users.find_one({"emails": {"$in": [user["email"]]}})
    user["isAuthorized"] = bool(is_authorized)
    return jsonify(user)

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200

@app.route("/api/check-authorization")
def check_authorization():
    email = request.args.get("email")
    is_authorized = authorized_users.find_one({"email": email})
    return jsonify({"isAuthorized": bool(is_authorized)})

@app.route("/api/elements-with-data", methods=["GET"])
def get_elements_with_data():
    try:
        elements = collection.distinct("element")
        return jsonify(elements)
    except Exception as e:
        print(f"Error getting elements with data: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
    
@app.route("/api/pending-submissions", methods=["GET"])
def get_pending_submissions():
    user = session.get('user')
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    
    is_authorized = authorized_users.find_one({"emails": {"$in": [user.get("email")]}})
    if not is_authorized:
        return jsonify({"error": "Not authorized"}), 403
    
    submissions = list(pending_submissions.find())
    for submission in submissions:
        submission["_id"] = str(submission["_id"])
    
    return jsonify(submissions)

@app.route("/api/submissions/<submission_id>", methods=["PUT"])
def handle_submission(submission_id):
    user = session.get('user')
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    
    is_authorized = authorized_users.find_one({"emails": {"$in": [user.get("email")]}})
    if not is_authorized:
        return jsonify({"error": "Not authorized"}), 403
    
    data = request.get_json()
    action = data.get('action')
    comments = data.get('comments', '')
    
    submission = pending_submissions.find_one({"_id": ObjectId(submission_id)})
    if not submission:
        return jsonify({"error": "Submission not found"}), 404
    
    if action == 'approve':
        # Add the data to main collection
        result = add_data_to_db(submission['data'], submission['submitter'])
        if result[1] != 201:
            return jsonify({"error": "Failed to add data"}), 500
        
        # Remove from pending submissions
        pending_submissions.delete_one({"_id": ObjectId(submission_id)})
        
    elif action == 'reject':
        if not comments:
            return jsonify({"error": "Comments required for rejection"}), 400
            
        # Send rejection email
        user_msg = Message(
            'Submission Rejected - ASD Platform',
            sender=Config.ADMIN_EMAIL,
            recipients=[submission['submitter']['email']]
        )
        user_msg.html = f"""
            <h3>Submission Rejected</h3>
            <p>Your recent data submission has been rejected.</p>
            <p><strong>Reviewer Comments:</strong></p>
            <p>{comments}</p>
            <p>Please review the comments and submit again.</p>
        """
        mail.send(user_msg)
        
        pending_submissions.delete_one({"_id": ObjectId(submission_id)})
    
    return jsonify({"message": f"Submission {action}d successfully"})

@app.route("/api/data", methods=["POST"])
def add_data():
    user = session.get('user')
    data = request.get_json()
    
    is_authorized = authorized_users.find_one({"email": user.get("email")})
    
    submitter = {
        "email": user.get("email"),
        "name": user.get("name", "Unknown"),
        "submission_date": datetime.now()
    }
    
    if is_authorized:
        return add_data_to_db(data, submitter)
    else:
        pending_submissions.insert_one({
            "data": data,
            "submitter": submitter,
            "status": "pending",
            "submission_date": datetime.now()
        })
        return jsonify({
            "message": "Your submission is pending approval. You will be notified if any changes are needed.",
            "status": "pending"
        }), 201

def add_data_to_db(data, submitter):    
    element = data.get("element")
    material = data.get("material")
    technique = data.get("technique", "")
    precursor = data.get("precursor")
    coreactant = data.get("coreactant")
    surface = data.get("surface")
    pretreatment = data.get("pretreatment")
    temperature = data.get("temperature")
    publication_data = data.get("publication", {})
    if isinstance(publication_data, str):
        publication_data = {
            "authors": [publication_data],
            "title": "",
            "doi": "",
            "journal": "",
            "journal_full": "",
            "year": "",
            "volume": "",
            "issue": "",
            "pages": ""
        }
    authors = publication_data.get("authors", [])
    if isinstance(authors, str):
        authors = [authors]
    elif not authors and publication_data.get("author"):
        authors = [publication_data.get("author")]

    publication_data = {
        "authors": authors,
        "title": publication_data.get("title", ""),
        "journal": publication_data.get("journal", ""),
        "journal_full": publication_data.get("journal_full", ""),
        "year": publication_data.get("year", ""),
        "volume": publication_data.get("volume", ""),
        "issue": publication_data.get("issue", ""),
        "pages": publication_data.get("pages", ""),
        "doi": publication_data.get("doi", "")
    }
    readings = data.get("readings", [])
    
    if not element:
        return jsonify({"error": "Element is required"}), 400
    
    # Step 01: Find the element or create if not present
    element_doc = collection.find_one({"element": element})
    if not element_doc:
        element_doc = {
            "element": element,
            "materials": []
        }
        
    # Step 02: Checking if material exists under the element
    material_doc = next(
        (m for m in element_doc["materials"] 
         if m["material"] == material and m["technique"] == technique), 
        None
    )
    
    if not material_doc:
        material_doc = {
            "material": material,
            "technique": technique,
            "pre_cor": []
        }
        element_doc["materials"].append(material_doc)
        
    # Step 03: Check if precursor-coreactant pair exists
    pair = f"{precursor}|{coreactant}"
    pair_doc = next((p for p in material_doc["pre_cor"] if p["precursor"] == precursor and p["coreactant"] == coreactant), None)
    if not pair_doc:
        pair_doc = {
            "precursor": precursor,
            "coreactant": coreactant,
            "conditions": []
        }
        material_doc["pre_cor"].append(pair_doc)
        
    # Step 04: Check if (surface + pretreatment + temperature) exists
    condition_doc = next(
        (c for c in pair_doc.get("conditions", []) 
         if c["surface"] == surface and 
         c["pretreatment"] == pretreatment and 
         c["temperature"] == temperature),
        None
    )
    if not condition_doc:
        condition_doc = {
            "surface": surface,
            "pretreatment": pretreatment,
            "temperature": temperature,
            "publications": []
        }
        pair_doc["conditions"].append(condition_doc)
        
    def matches_publication(existing_pub, new_pub_data):
        """Check if publications match based on authors and key metadata"""
        existing_authors = existing_pub.get("authors", [existing_pub.get("author", "")])
        new_authors = new_pub_data.get("authors", [])
        
        if isinstance(existing_authors, str):
            existing_authors = [existing_authors]
        if isinstance(new_authors, str):
            new_authors = [new_authors]
        
        first_author_match = (existing_authors and new_authors and 
                            existing_authors[0] == new_authors[0])
        journal_match = existing_pub.get("journal") == new_pub_data.get("journal")
        year_match = existing_pub.get("year") == new_pub_data.get("year")
        
        title_match = True
        if existing_pub.get("title") and new_pub_data.get("title"):
            title_match = existing_pub.get("title") == new_pub_data.get("title")
        
        return first_author_match and journal_match and year_match and title_match

    pub_doc = next(
        (p for p in condition_doc.get("publications", [])
        if matches_publication(p, publication_data)),
        None
    )
    
    if pub_doc:
        pub_doc["readings"] = readings
        pub_doc["submittedBy"] = submitter
    else:
        condition_doc["publications"].append({
            "publication": publication_data,
            "readings": readings,
            "submittedBy": submitter
        })
        
    if "_id" in element_doc:
        element_doc.pop("_id")
    collection.replace_one({"element": element}, element_doc, upsert=True)
    
    return jsonify({"message": "Data added successfully"}), 201

@app.route("/api/update-data", methods=["PUT"])
def update_data():
    try:
        user = session.get('user')
        if not user:
            return jsonify({"error": "Not authenticated"}), 401

        data = request.get_json()
        original = data.get("original")
        updated_groups = data.get("updatedGroups")

        if not original or not updated_groups:
            return jsonify({"error": "Both original and updatedGroups are required"}), 400

        element_doc = collection.find_one({"element": original["element"]})
        if not element_doc:
            return jsonify({"error": "Element not found"}), 404

        # Step 1: Remove all publications from the original location
        original_material = next(
            (m for m in element_doc["materials"]
             if m["material"] == original["material"] and
             m.get("technique", "") == original.get("technique", "")),
            None
        )
        if original_material:
            original_pair = next(
                (p for p in original_material["pre_cor"]
                 if p["precursor"] == original["precursor"] and
                 p["coreactant"] == original["coreactant"]),
                None
            )
            if original_pair:
                original_condition = next(
                    (c for c in original_pair["conditions"]
                     if c["surface"] == original["surface"] and
                     c["pretreatment"] == original["pretreatment"]),
                    None
                )
                if original_condition:
                    original_condition["publications"] = []

        # Step 2: Add publications to their new locations
        for group in updated_groups:
            for pub_data in group["publications"]:
                normalized_pub = {
                    "authors": pub_data.get("authors", []),
                    "title": pub_data.get("title", ""),
                    "journal": pub_data.get("journal", ""),
                    "journal_full": pub_data.get("journal_full", ""),
                    "year": pub_data.get("year", ""),
                    "volume": pub_data.get("volume", ""),
                    "issue": pub_data.get("issue", ""),
                    "pages": pub_data.get("pages", ""),
                    "doi": pub_data.get("doi", "")
                }
                
                if not normalized_pub["authors"] and pub_data.get("author"):
                    normalized_pub["authors"] = [pub_data["author"]]
                
                # Ensure authors is always an array
                if isinstance(normalized_pub["authors"], str):
                    normalized_pub["authors"] = [normalized_pub["authors"]]

                pub_readings = next(
                    (r["readings"] for r in group["readings"]
                    if publication_matches(r["publication"], pub_data)),
                    []
                )
                # Find or create target location for this publication
                target_material = next(
                    (m for m in element_doc["materials"]
                     if m["material"] == group["material"] and
                     m.get("technique", "") == group.get("technique", "")),
                    None
                )
                if not target_material:
                    target_material = {
                        "material": group["material"],
                        "technique": group.get("technique", ""),
                        "pre_cor": []
                    }
                    element_doc["materials"].append(target_material)

                target_pair = next(
                    (p for p in target_material["pre_cor"]
                     if p["precursor"] == group["precursor"] and
                     p["coreactant"] == group["coreactant"]),
                    None
                )
                if not target_pair:
                    target_pair = {
                        "precursor": group["precursor"],
                        "coreactant": group["coreactant"],
                        "conditions": []
                    }
                    target_material["pre_cor"].append(target_pair)

                target_condition = next(
                    (c for c in target_pair["conditions"]
                     if c["surface"] == group["surface"] and
                     c["pretreatment"] == group["pretreatment"]),
                    None
                )
                if not target_condition:
                    target_condition = {
                        "surface": group["surface"],
                        "pretreatment": group["pretreatment"],
                        "temperature": group.get("temperature"),
                        "publications": []
                    }
                    target_pair["conditions"].append(target_condition)

                # Add publication to target location
                existing_pub = next(
                    (p for p in target_condition["publications"]
                    if publication_matches(p["publication"], normalized_pub)),
                    None
                )
                if existing_pub:
                    existing_pub["publication"] = normalized_pub
                    existing_pub["readings"] = pub_readings
                else:
                    target_condition["publications"].append({
                        "publication": normalized_pub,
                        "readings": pub_readings,
                        "submittedBy": {
                            "email": user.get("email"),
                            "name": user.get("name", "Unknown"),
                            "submission_date": datetime.now()
                        }
                    })

        # Step 3: Clean up empty structures
        for material in element_doc["materials"][:]:
            for pair in material["pre_cor"][:]:
                pair["conditions"] = [c for c in pair["conditions"] if c["publications"]]
                if not pair["conditions"]:
                    material["pre_cor"].remove(pair)
            if not material["pre_cor"]:
                element_doc["materials"].remove(material)

        collection.replace_one({"element": original["element"]}, element_doc)
        return jsonify({"message": "Data updated successfully"}), 200

    except Exception as e:
        print(f"Error updating data: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

def notify_authorized_users(data, submitter):
    authorized_emails = [user["email"] for user in authorized_users.find()]
    
    for email in authorized_emails:
        notify_msg = Message(
            'New Data Submission - ASD Platform',
            sender=Config.ADMIN_EMAIL,
            recipients=[email]
        )
        notify_msg.html = f"""
            <h3>New Data Submission</h3>
            <p><strong>Submitter:</strong> {submitter['name']}</p>
            <p><strong>Element:</strong> {data['element']}</p>
            <p><strong>Material:</strong> {data['material']}</p>
            <p><strong>Technique:</strong> {data.get('technique', '-')}</p>
            <p>Please review the submission on the platform.</p>
        """
        mail.send(notify_msg)

@app.route("/api/initialize-publication-fields", methods=["POST"])
def initialize_publication_fields():
    """Initialize new publication fields for all existing entries"""
    user = session.get('user')
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    
    is_authorized = authorized_users.find_one({"emails": {"$in": [user.get("email")]}})
    if not is_authorized:
        return jsonify({"error": "Not authorized"}), 403
    
    try:
        updated_count = 0
        all_docs = list(collection.find())
        
        for doc in all_docs:
            modified = False
            
            for material in doc.get("materials", []):
                for pair in material.get("pre_cor", []):
                    for condition in pair.get("conditions", []):
                        for pub in condition.get("publications", []):
                            publication = pub.get("publication", {})
                            
                            # Migrate old 'author' field to 'authors' array
                            if "author" in publication and "authors" not in publication:
                                publication["authors"] = [publication["author"]]
                                del publication["author"]
                                modified = True
                            elif "author" in publication:
                                del publication["author"]
                                modified = True
                            
                            # Ensure authors is always an array
                            if "authors" in publication and isinstance(publication["authors"], str):
                                publication["authors"] = [publication["authors"]]
                                modified = True
                            
                            # Initialize new fields with empty values if not present
                            new_fields = {
                                "title": "",
                                "journal_full": "",
                                "volume": "",
                                "issue": "",
                                "pages": ""
                            }
                            
                            for field, default_value in new_fields.items():
                                if field not in publication:
                                    publication[field] = default_value
                                    modified = True
            
            if modified:
                collection.replace_one({"_id": doc["_id"]}, doc)
                updated_count += 1
        
        return jsonify({
            "message": f"Successfully initialized fields in {updated_count} documents",
            "total_checked": len(all_docs)
        }), 200
        
    except Exception as e:
        print(f"Initialization error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/extract-filter-params", methods=["POST"])
def extract_filter_params():
    """Extract filter parameters from natural language query using Gemini"""
    user = session.get('user')
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        data = request.get_json()
        query = data.get('query', '')
        
        if not query:
            return jsonify({"error": "Query is required"}), 400
        
        genai.configure(api_key=Config.GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        prompt = f"""Extract ASD filter parameters from this natural language query.

Query: "{query}"

Available parameters to extract:
- material: The deposited material (e.g., SiO2, TiO2, Al2O3, ZnO)
- surface: The substrate/surface (e.g., Si, SiO2, glass, metal)
- technique: Deposition technique (e.g., ALD, CVD, PECVD, MLD)
- precursor: Precursor compound used
- coreactant: Reactive species (e.g., H2O, O2, NH3)
- pretreatment: Surface treatment (e.g., Dilute HF, O2 plasma, UV-Ozone)

Return ONLY a JSON object with extracted parameters. If a parameter is not mentioned, omit it from the response.

Example input: "Show me SiO2 material deposited on Dilute HF surface"
Example output: {{"material": "SiO2", "pretreatment": "Dilute HF"}}

JSON response:"""
        
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        import re
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            parameters = json.loads(json_match.group())
            return jsonify({
                "status": "success",
                "parameters": parameters,
                "original_query": query
            })
        else:
            raise ValueError("No valid JSON in response")
            
    except Exception as e:
        print(f"Error extracting parameters: {str(e)}")
        return jsonify({
            "error": f"Failed to extract parameters: {str(e)}"
        }), 500
        
@app.route("/api/materials", methods=["GET"])
def get_materials():
    element = request.args.get("element")
    doc = collection.find_one({"element": element})
    if not doc:
        return jsonify([])
    materials = [m["material"] for m in doc.get("materials", [])]
    return jsonify(materials)

@app.route("/api/extract-pdf-data", methods=["POST", "OPTIONS"])
def extract_pdf_data():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        return response
    
    try:
        user = session.get('user')
        if not user:
            app.logger.error("Unauthorized access attempt to PDF extraction")
            return jsonify({"status": "error", "error": "Not authenticated"}), 401
        
        app.logger.info(f"PDF extraction request from user: {user.get('email')}")
        
        if 'pdf' not in request.files:
            app.logger.error("No PDF file in request")
            return jsonify({"status": "error", "error": "No PDF file provided"}), 400
        
        file = request.files['pdf']
        if file.filename == '':
            app.logger.error("Empty filename")
            return jsonify({"status": "error", "error": "No file selected"}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            app.logger.error(f"Invalid file type: {file.filename}")
            return jsonify({"status": "error", "error": "File must be a PDF"}), 400
        
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        app.logger.info(f"Processing PDF: {file.filename}, Size: {file_size} bytes")
        
        if file_size > 10 * 1024 * 1024:
            app.logger.error(f"File too large: {file_size} bytes")
            return jsonify({"status": "error", "error": "PDF file too large. Maximum size is 10MB"}), 400
        
        if file_size == 0:
            app.logger.error("Empty file uploaded")
            return jsonify({"status": "error", "error": "Uploaded file is empty"}), 400
        
        tmp_file_path = None
        
        try:
            if not Config.GEMINI_API_KEY:
                app.logger.error("GEMINI_API_KEY not configured")
                return jsonify({
                    "status": "error",
                    "error": "AI extraction service not configured. Please contact administrator."
                }), 500
            try:
                tmp_dir = tempfile.gettempdir()
                app.logger.info(f"Using temp directory: {tmp_dir}")
                fd, tmp_file_path = tempfile.mkstemp(suffix='.pdf', dir=tmp_dir)
                os.close(fd)
                file.save(tmp_file_path)
                app.logger.info(f"PDF saved to: {tmp_file_path}")
                if not os.path.exists(tmp_file_path):
                    raise Exception("Failed to save file to temporary location")
                
                saved_size = os.path.getsize(tmp_file_path)
                app.logger.info(f"Saved file size: {saved_size} bytes")
                
            except Exception as e:
                app.logger.error(f"Failed to create temp file: {str(e)}")
                app.logger.error(traceback.format_exc())
                return jsonify({
                    "status": "error",
                    "error": f"Failed to process uploaded file: {str(e)}"
                }), 500
            try:
                from script import ASDParameterExtractor
                app.logger.info("ASDParameterExtractor imported successfully")
            except ImportError as ie:
                app.logger.error(f"Failed to import ASDParameterExtractor: {str(ie)}")
                return jsonify({
                    "status": "error",
                    "error": "Extraction module not available"
                }), 500
            
            app.logger.info("Initializing ASDParameterExtractor...")
            extractor = ASDParameterExtractor(Config.GEMINI_API_KEY)
            
            app.logger.info("Starting PDF extraction...")
            result = extractor.extract_from_pdf(tmp_file_path)
            app.logger.info(f"Extraction completed with status: {result.get('status')}")
            
            if result['status'] == 'success':
                form_data = {
                    'element': result.get('element', ''),
                    'material': result.get('deposited_material', ''),
                    'technique': result.get('deposition_technique', ''),
                    'precursor': result.get('precursor', ''),
                    'coreactant': result.get('coreactant', ''),
                    'surface': result.get('surface_substrate', ''),
                    'pretreatment': result.get('surface_pretreatment', ''),
                    'title': result.get('title', ''),
                    'authors': result.get('authors', []),
                    'journal': result.get('journal', ''),
                    'journal_full': result.get('journal_full', ''),
                    'year': result.get('year', ''),
                    'volume': result.get('volume', ''),
                    'issue': result.get('issue', ''),
                    'pages': result.get('pages', ''),
                    'doi': result.get('doi', ''),
                    'confidence': result.get('confidence', 'low')
                }
                
                app.logger.info("Successfully extracted data from PDF")
                response_data = {
                    'status': 'success',
                    'data': form_data,
                    'confidence': result.get('confidence', 'low')
                }
                app.logger.info(f"Sending response: {response_data}")
                return jsonify(response_data), 200
            else:
                error_msg = result.get('error', 'Extraction failed')
                app.logger.error(f"Extraction failed: {error_msg}")
                return jsonify({
                    'status': 'error', 
                    'error': error_msg
                }), 500
                    
        except Exception as e:
            error_msg = f"Unexpected error during PDF extraction: {str(e)}"
            app.logger.error(error_msg)
            app.logger.error(traceback.format_exc())
            return jsonify({
                'status': 'error', 
                'error': error_msg
            }), 500
            
        finally:
            if tmp_file_path and os.path.exists(tmp_file_path):
                try:
                    os.unlink(tmp_file_path)
                    app.logger.info(f"Cleaned up temp file: {tmp_file_path}")
                except Exception as e:
                    app.logger.warning(f"Failed to delete temp file {tmp_file_path}: {e}")
    
    except Exception as outer_e:
        app.logger.error(f"Outer exception in extract_pdf_data: {str(outer_e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'error': f'Server error: {str(outer_e)}'
        }), 500

@app.route("/api/precursors", methods=["GET"])
def get_precursors_and_coreactants():
    element = request.args.get("element")
    material = request.args.get("material")
    doc = collection.find_one({"element": element})
    if not doc:
        return jsonify({"precursors": [], "coReactants": []})
    
    material_doc = next((m for m in doc.get("materials", []) if m["material"] == material), None)
    if not material_doc:
        return jsonify({"precursors": [], "coReactants": []})
    
    precursors = list({p["precursor"] for p in material_doc.get("pre_cor", [])})
    coReactants = list({p["coreactant"] for p in material_doc.get("pre_cor", [])})
    return jsonify({"precursors": precursors, "coReactants": coReactants})

@app.route("/api/surfaces", methods=["GET"])
def get_surfaces_and_pretreatment():
    element = request.args.get("element")
    material = request.args.get("material")
    precursor = request.args.get("precursor")
    coreactant = request.args.get("coreactant")
    
    doc = collection.find_one({"element": element})
    if not doc:
        return jsonify({"surfaces": [], "pretreatments": []})
    
    material_doc = next((m for m in doc.get("materials", []) if m["material"] == material), None)
    if not material_doc:
        return jsonify({"surfaces": [], "pretreatments": [], "temperatures": []})
    
    pair_doc = next((p for p in material_doc.get("pre_cor", []) if p["precursor"] == precursor and p["coreactant"] == coreactant), None)
    if not pair_doc:
        return jsonify({"surfaces": [], "pretreatments": []})
    
    surfaces = list({c["surface"] for c in pair_doc.get("conditions", [])})
    pretreatments = list({c["pretreatment"] for c in pair_doc.get("conditions", [])})
    
    return jsonify({"surfaces": surfaces, "pretreatments": pretreatments})

@app.route("/api/publications", methods=["GET"])
def get_publications():
    element = request.args.get("element")
    material = request.args.get("material")
    precursor = request.args.get("precursor")
    coreactant = request.args.get("coreactant")
    surface = request.args.get("surface")
    pretreatment = request.args.get("pretreatment")
    
    doc = collection.find_one({"element": element})
    if not doc:
        return jsonify([])
    
    material_doc = next((m for m in doc.get("materials", []) if m["material"] == material), None)
    if not material_doc:
        return jsonify([])
    
    pair_doc = next((p for p in material_doc.get("pre_cor", []) if p["precursor"] == precursor and p["coreactant"] == coreactant), None)
    if not pair_doc:
        return jsonify([])
    
    condition_doc = next((c for c in pair_doc.get("conditions", []) if c["surface"] == surface and c["pretreatment"] == pretreatment), None)
    if not condition_doc:
        return jsonify([])
    
    publications = [p["publication"] for p in condition_doc.get("publications", [])]
    
    return jsonify(publications)

@app.route("/api/readings")
def get_readings():
    try:
        element = request.args.get('element')
        material = request.args.get('material')
        precursor = request.args.get('precursor')
        coreactant = request.args.get('coreactant')
        surface = request.args.get('surface')
        pretreatment = request.args.get('pretreatment')
        temperature = request.args.get('temperature')
        publication = json.loads(request.args.get('publication'))

        match_conditions = {}

        if publication.get("authors"):
            authors = publication["authors"]
            if isinstance(authors, list) and authors:
                match_conditions["materials.pre_cor.conditions.publications.publication.authors"] = {"$in": [authors[0]]}
            elif isinstance(authors, str):
                match_conditions["materials.pre_cor.conditions.publications.publication.authors"] = {"$in": [authors]}
        elif publication.get("author"):
            match_conditions["$or"] = [
                {"materials.pre_cor.conditions.publications.publication.author": publication["author"]},
                {"materials.pre_cor.conditions.publications.publication.authors": {"$in": [publication["author"]]}}
            ]
        
        if publication.get("journal"):
            match_conditions["materials.pre_cor.conditions.publications.publication.journal"] = publication["journal"]
        if publication.get("year"):
            match_conditions["materials.pre_cor.conditions.publications.publication.year"] = publication["year"]

        pipeline = [
            {"$match": {"element": element}},
            {"$unwind": "$materials"},
            {"$match": {"materials.material": material}},
            {"$unwind": "$materials.pre_cor"}, 
            {"$match": {
                "materials.pre_cor.precursor": precursor,
                "materials.pre_cor.coreactant": coreactant
            }},
            {"$unwind": "$materials.pre_cor.conditions"},
            {"$match": {
                "materials.pre_cor.conditions.surface": surface,
                "materials.pre_cor.conditions.pretreatment": pretreatment,
                "materials.pre_cor.conditions.temperature": temperature
            }},
            {"$unwind": "$materials.pre_cor.conditions.publications"},
            {"$match": match_conditions},
            {"$project": {
                "readings": "$materials.pre_cor.conditions.publications.readings"
            }}
        ]

        result = list(collection.aggregate(pipeline))

        if not result:
            return jsonify([])

        readings = result[0].get('readings', [])
        return jsonify(readings)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/element-data", methods=["GET"])
def get_element_data():
    try:
        element = request.args.get("element")
        if not element:
            return jsonify({"error": "Element parameter is required"}), 400

        doc = collection.find_one({"element": element})
        if not doc:
            return jsonify([])

        formatted_data = []
        for material in doc.get("materials", []):
            material_name = material["material"]
            technique = material.get("technique", "")
            for pair in material.get("pre_cor", []):
                precursor = pair["precursor"]
                coreactant = pair["coreactant"]
                for condition in pair.get("conditions", []):
                    surface = condition["surface"]
                    pretreatment = condition["pretreatment"]
                    temperature = condition.get("temperature")
                    
                    publications = [pub["publication"] for pub in condition.get("publications", [])]
                    
                    formatted_data.append({
                        "material": material_name,
                        "technique": technique,
                        "precursor": precursor,
                        "coreactant": coreactant,
                        "surface": surface,
                        "pretreatment": pretreatment,
                        "temperature": temperature,
                        "publications": publications
                    })

        return jsonify(formatted_data)
    except Exception as e:
        print(f"Error getting element data: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
    
@app.route("/api/surfaces-with-data", methods=["GET"])
def get_surfaces_with_data():
    try:
        pipeline = [
            {"$unwind": "$materials"},
            {"$unwind": "$materials.pre_cor"},
            {"$unwind": "$materials.pre_cor.conditions"},
            {
                "$group": {
                    "_id": {
                        "$substr": [
                            "$materials.pre_cor.conditions.surface",
                            0,
                            {"$indexOfBytes": ["$materials.pre_cor.conditions.surface", " "]}
                        ]
                    }
                }
            },
            {"$project": {"_id": 0, "element": "$_id"}}
        ]
        
        result = list(collection.aggregate(pipeline))
        surface_elements = [doc["element"] for doc in result if doc["element"]]
        return jsonify(surface_elements)
    except Exception as e:
        print(f"Error getting surface elements: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
    
@app.route("/api/element-data-by-surface", methods=["GET"])
def get_element_data_by_surface():
    try:
        surface_element = request.args.get("surface")
        if not surface_element:
            return jsonify({"error": "Surface parameter is required"}), 400

        pipeline = [
            {"$unwind": "$materials"},
            {"$unwind": "$materials.pre_cor"},
            {"$unwind": "$materials.pre_cor.conditions"},
            {
                "$match": {
                    "$expr": {
                        "$eq": [
                            {
                                "$substr": [
                                    "$materials.pre_cor.conditions.surface",
                                    0,
                                    {"$strLenBytes": surface_element}
                                ]
                            },
                            surface_element
                        ]
                    }
                }
            },
            {
                "$group": {
                    "_id": {
                        "element": "$element",
                        "material": "$materials.material",
                        "technique": "$materials.technique",
                        "precursor": "$materials.pre_cor.precursor",
                        "coreactant": "$materials.pre_cor.coreactant",
                        "surface": "$materials.pre_cor.conditions.surface",
                        "pretreatment": "$materials.pre_cor.conditions.pretreatment",
                        "temperature": "$materials.pre_cor.conditions.temperature"
                    },
                    "publications": {
                        "$push": "$materials.pre_cor.conditions.publications"
                    }
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "element": "$_id.element",
                    "material": "$_id.material",
                    "technique": "$_id.technique",
                    "precursor": "$_id.precursor",
                    "coreactant": "$_id.coreactant",
                    "surface": "$_id.surface",
                    "pretreatment": "$_id.pretreatment",
                    "temperature": "$_id.temperature",
                    "publications": {
                        "$reduce": {
                            "input": "$publications",
                            "initialValue": [],
                            "in": {"$concatArrays": ["$$value", "$$this"]}
                        }
                    }
                }
            }
        ]

        result = list(collection.aggregate(pipeline))
        for row in result:
            if isinstance(row.get('publications'), list):
                flat_pubs = []
                for pub in row['publications']:
                    if isinstance(pub, list):
                        flat_pubs.extend(pub)
                    else:
                        flat_pubs.append(pub)
                # Now, for each pub, if it's a dict with a 'publication' key, extract it
                row['publications'] = [
                    p['publication'] if isinstance(p, dict) and 'publication' in p else p
                    for p in flat_pubs
                ]
        return jsonify(result)
    except Exception as e:
        print(f"Error getting surface data: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

def publication_matches(stored_pub, target_pub):
    """Check if a stored publication matches a target publication"""
    # Handle both legacy author and new authors format
    stored_authors = stored_pub.get("authors", [stored_pub.get("author", "")])
    target_authors = target_pub.get("authors", [target_pub.get("author", "")])
    
    if isinstance(stored_authors, str):
        stored_authors = [stored_authors]
    if isinstance(target_authors, str):
        target_authors = [target_authors]
    
    # Match on first author
    first_author_match = (stored_authors and target_authors and 
                         stored_authors[0] == target_authors[0])
    
    journal_match = stored_pub.get('journal', '') == target_pub.get('journal', '')
    year_match = stored_pub.get('year', '') == target_pub.get('year', '')
    
    return first_author_match and journal_match and year_match

@app.route("/api/delete-data", methods=["DELETE"])
def delete_data():
    try:
        user = session.get('user')
        if not user:
            return jsonify({"error": "Not authenticated"}), 401
        
        is_authorized = authorized_users.find_one({"emails": {"$in": [user.get("email")]}})
        if not is_authorized:
            return jsonify({"error": "Not authorized"}), 403

        data = request.get_json()
        element = data.get('element')
        row_data = data.get('rowData')
        delete_type = data.get('type')
        publications = data.get('publications', [])

        element_doc = collection.find_one({"element": element})
        if not element_doc:
            return jsonify({"error": "Element not found"}), 404

        # For single publication row deletion
        if delete_type == 'row' and len(row_data.get('publications', [])) == 1:
            publications = row_data.get('publications', [])

        if delete_type == 'row':
            # Remove the entire condition
            for material in element_doc['materials']:
                if material['material'] == row_data['material']:
                    for pair in material['pre_cor']:
                        if (pair['precursor'] == row_data['precursor'] and 
                            pair['coreactant'] == row_data['coreactant']):
                            pair['conditions'] = [
                                c for c in pair['conditions']
                                if not (c['surface'] == row_data['surface'] and 
                                      c['pretreatment'] == row_data['pretreatment'] and
                                      c.get('temperature') == row_data.get('temperature'))
                            ]
        elif delete_type == 'publications':
            # Remove only the selected publications from the condition
            for material in element_doc['materials']:
                if material['material'] == row_data['material']:
                    for pair in material['pre_cor']:
                        if (pair['precursor'] == row_data['precursor'] and 
                            pair['coreactant'] == row_data['coreactant']):
                            for condition in pair['conditions']:
                                if (condition['surface'] == row_data['surface'] and 
                                    condition['pretreatment'] == row_data['pretreatment'] and
                                    condition.get('temperature') == row_data.get('temperature')):
                                    # Remove publications that match any in the publications list
                                    condition['publications'] = [
                                        pub for pub in condition['publications']
                                        if not any(
                                            publication_matches(pub['publication'], p)
                                            for p in publications
                                        )
                                    ]

        # Clean up empty structures
        for material in element_doc['materials'][:]:
            for pair in material['pre_cor'][:]:
                pair['conditions'] = [c for c in pair['conditions'] if c['publications']]
                if not pair['conditions']:
                    material['pre_cor'].remove(pair)
            if not material['pre_cor']:
                element_doc['materials'].remove(material)

        collection.replace_one({"element": element}, element_doc)
        
        return jsonify({"message": "Data deleted successfully"}), 200

    except Exception as e:
        print(f"Error deleting data: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/all-filters")
def all_filters():
    materials = set()
    surfaces = set()
    techniques = set()
    for doc in collection.find():
        for m in doc.get("materials", []):
            materials.add(m["material"])
            techniques.add(m.get("technique", ""))
            for pc in m.get("pre_cor", []):
                for cond in pc.get("conditions", []):
                    surfaces.add(cond["surface"])
    return jsonify({
        "materials": sorted(materials),
        "surfaces": sorted(surfaces),
        "techniques": sorted(techniques)
    })

@app.route("/api/filter-options")
def filter_options():
    material = request.args.get("material")
    surface = request.args.get("surface")
    technique = request.args.get("technique")

    materials = set()
    surfaces = set()
    techniques = set()
    for doc in collection.find():
        for m in doc.get("materials", []):
            if material and m["material"] != material:
                continue
            if technique and m.get("technique", "") != technique:
                continue
            for pc in m.get("pre_cor", []):
                for cond in pc.get("conditions", []):
                    if surface and cond["surface"] != surface:
                        continue
                    materials.add(m["material"])
                    techniques.add(m.get("technique", ""))
                    surfaces.add(cond["surface"])
    return jsonify({
        "materials": sorted(materials),
        "surfaces": sorted(surfaces),
        "techniques": sorted(techniques)
    })

@app.route("/api/filter-data")
def filter_data():
    material = request.args.get("material")
    surface = request.args.get("surface")
    technique = request.args.get("technique")

    results = []
    for doc in collection.find():
        for m in doc.get("materials", []):
            if material and m["material"] != material:
                continue
            if technique and m.get("technique", "") != technique:
                continue
            for pc in m.get("pre_cor", []):
                for cond in pc.get("conditions", []):
                    if surface and cond["surface"] != surface:
                        continue
                    results.append({
                        "element": doc["element"],
                        "material": m["material"],
                        "technique": m.get("technique", ""),
                        "precursor": pc["precursor"],
                        "coreactant": pc["coreactant"],
                        "surface": cond["surface"],
                        "pretreatment": cond["pretreatment"],
                        "temperature": cond.get("temperature", ""),
                        "publications": [p["publication"] for p in cond.get("publications", [])]
                    })
    return jsonify(results)

# BACKEND FIX - Updated an_model endpoint and recompute function

@app.route("/api/an-model", methods=["POST"])
def an_model():
    try:
        data = request.get_json()
        print(f"=== AN-MODEL ENDPOINT DEBUG ===")
        print(f"Received data keys: {list(data.keys())}")
        
        growth = data.get("growth", [])
        nongrowth = data.get("nongrowth", [])
        custom_params = data.get("customParams", None)
        
        print(f"Growth data points: {len(growth)}")
        print(f"Non-growth data points: {len(nongrowth)}")
        print(f"Custom params present: {custom_params is not None}")
        
        # Validate input data
        if not growth or not nongrowth:
            return jsonify({
                "error": "Both growth and nongrowth data required",
                "received": {
                    "growth_points": len(growth),
                    "nongrowth_points": len(nongrowth)
                }
            }), 400
        
        # If custom parameters are provided, use them to recompute
        if custom_params:
            print(f"=== CUSTOM PARAMETER RECOMPUTATION ===")
            try:
                scenario_name = custom_params.get("scenario", "")
                params = custom_params.get("params", [])
                
                print(f"Scenario: {scenario_name}")
                print(f"Parameters received: {params}")
                print(f"Parameter types: {[type(p) for p in params]}")
                
                # Validate parameters before proceeding
                if not params or len(params) != 3:
                    raise ValueError(f"Expected 3 parameters, got {len(params)}: {params}")
                
                # Check if vectorized_combination module is available
                try:
                    from vectorized_combination import AN_Model_py_vc_exact
                    print("Successfully imported AN_Model_py_vc_exact")
                except ImportError as ie:
                    print(f"Import error: {ie}")
                    return jsonify({
                        "error": f"Computation module not available: {str(ie)}",
                        "fallback_message": "Cannot import required computation functions"
                    }), 500
                
                # Recompute model with custom parameters
                result = recompute_with_custom_params(growth, nongrowth, scenario_name, params)
                print(f"Recomputation successful. Returning result.")
                return jsonify(result)
                
            except ValueError as ve:
                print(f"Validation error: {str(ve)}")
                return jsonify({
                    "error": f"Parameter validation failed: {str(ve)}",
                    "fallback_message": "Invalid parameter format or values"
                }), 400
                
            except Exception as e:
                print(f"Error recomputing with custom parameters: {str(e)}")
                print(f"Traceback: {traceback.format_exc()}")
                return jsonify({
                    "error": f"Custom parameter computation failed: {str(e)}",
                    "fallback_message": "Parameter modification failed",
                    "traceback": traceback.format_exc()[-500:] if hasattr(traceback, 'format_exc') else str(e)
                }), 500
        
        # Regular computation path (existing code)
        lab_payload = {
            "growth": growth,
            "nongrowth": nongrowth
        }
        
        # Call lab device computation service
        lab_url = "https://2ee6d0e0fd14.ngrok-free.app/compute/an-model"
        
        print(f"Sending computation request to lab device: {lab_url}")
        
        # Make request to lab device with timeout
        response = requests.post(
            lab_url,
            json=lab_payload,
            headers={
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true"
            },
            timeout=300
        )
        
        # Check if request was successful
        if response.status_code == 200:
            result = response.json()
            print(f"Lab computation successful. Best scenario: {result.get('best_scenario', 'Unknown')}")
            return jsonify(result)
        else:
            error_msg = f"Lab device returned error: {response.status_code}"
            try:
                error_detail = response.json()
                error_msg += f" - {error_detail.get('error', 'Unknown error')}"
            except:
                error_msg += f" - {response.text}"
            
            print(f"Lab device error: {error_msg}")
            return jsonify({
                "error": error_msg,
                "fallback_message": "Computation failed on lab device"
            }), 500
            
    except requests.exceptions.Timeout:
        return jsonify({
            "error": "Lab device computation timed out",
            "message": "The computation is taking longer than expected"
        }), 504
        
    except requests.exceptions.ConnectionError:
        return jsonify({
            "error": "Could not connect to lab device",
            "message": "Please check if the lab device is online and the ngrok tunnel is active"
        }), 503
        
    except Exception as e:
        print(f"Error calling lab device: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "error": f"Failed to process computation request: {str(e)}",
            "message": "An unexpected error occurred"
        }), 500

def recompute_with_custom_params(growth, nongrowth, scenario_name, params):
    """
    Recompute model with custom parameters - FIXED VERSION
    """
    try:
        print(f"=== RECOMPUTE WITH CUSTOM PARAMS DEBUG ===")
        print(f"Scenario: {scenario_name}")
        print(f"Received params: {params} (type: {type(params)})")
        
        # Use the local AN model function with custom parameters
        data1 = np.array(growth, dtype=np.float64)
        data2 = np.array(nongrowth, dtype=np.float64)
        
        print(f"Data1 shape: {data1.shape}, Data2 shape: {data2.shape}")
        
        if len(data1) < 2:
            raise ValueError("Growth data must have at least 2 points")
        
        # Calculate gdot and ncycles (same as in vectorized_combination.py)
        growth_rate = np.sum((data1[1:,1] - data1[:-1,1]) / (data1[1:,0] - data1[:-1,0]))
        gdot = growth_rate / (len(data1) - 1)
        ncycles = int(data2[-1,0] * 1.5)
        
        print(f"Calculated: gdot={gdot:.6f}, ncycles={ncycles}")
        
        # Frontend always sends [nhat, ndot0, td] in that order
        if len(params) != 3:
            raise ValueError(f"Expected exactly 3 parameters [nhat, ndot0, td], got {len(params)}")
        
        nhat = float(params[0])
        ndot0 = float(params[1]) 
        td = int(float(params[2]))  # Convert to int but handle potential float input
        
        print(f"Parameter assignment:")
        print(f"  nhat = {nhat}")
        print(f"  ndot0 = {ndot0}")
        print(f"  td = {td}")
        
        # FIXED: Import and call the correct function
        try:
            from vectorized_combination import AN_Model_py_vc_exact
            print(f"Successfully imported AN_Model_py_vc_exact")
        except ImportError as e:
            print(f"Failed to import AN_Model_py_vc_exact: {e}")
            raise ValueError(f"Cannot import computation function: {e}")
        
        # Run the model with custom parameters
        print(f"Calling AN_Model_py_vc_exact with parameters...")
        rmse, V = AN_Model_py_vc_exact(gdot, nhat, ndot0, td, ncycles, data2, return_V=True)
        
        if V is None:
            raise ValueError("Model computation returned no results (V is None)")
        
        print(f"Model computation successful:")
        print(f"  RMSE: {rmse}")
        print(f"  V matrix shape: {V.shape}")
        
        # Prepare results in the same format as the original computation
        model_x = V[:, 1].tolist()
        model_growth_y = V[:, 2].tolist()
        model_nongrowth_y = V[:, 3].tolist()
        
        print(f"Prepared output:")
        print(f"  model_x length: {len(model_x)}")
        print(f"  model_growth_y length: {len(model_growth_y)}")
        print(f"  model_nongrowth_y length: {len(model_nongrowth_y)}")
        
        # Create scenario results with the custom parameters
        scenario_results = {
            scenario_name: {
                'rmse': float(rmse),
                'params': [nhat, ndot0, td],  # Return all three parameters
                'model_x': model_x,
                'model_growth_y': model_growth_y,
                'model_nongrowth_y': model_nongrowth_y
            }
        }
        
        result = {
            "best_scenario": scenario_name,
            "best_rmse": float(rmse),
            "best_params": [nhat, ndot0, td],
            "growth": data1.tolist(),
            "nongrowth": data2.tolist(),
            "model_x": model_x,
            "model_growth_y": model_growth_y,
            "model_nongrowth_y": model_nongrowth_y,
            "all_scenarios": scenario_results,
            "computation_time": 0,
            "custom_computation": True
        }
        
        print(f"Successfully created result object")
        print(f"Returning result with best_scenario: {result['best_scenario']}")
        print(f"Returning result with best_params: {result['best_params']}")
        
        return result
        
    except Exception as e:
        error_msg = f"Error in custom parameter computation: {str(e)}"
        print(error_msg)
        print(f"Traceback: {traceback.format_exc()}")
        raise Exception(error_msg)
    
if __name__ == "__main__":
    app.run(port=5001, debug=True)