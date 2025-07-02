from flask import Flask, jsonify, request, redirect, session
from authlib.integrations.flask_client import OAuth
from flask_cors import CORS
from pymongo import MongoClient
from config import Config
from flask_mail import Mail, Message
from datetime import datetime, timedelta
from bson.objectid import ObjectId
import json

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
            "author": publication_data,
            "doi": "",
            "journal": "",
            "year": ""
        }
    publication_data = {
        "author": publication_data.get("author", ""),
        "journal": publication_data.get("journal", ""),
        "year": publication_data.get("year", ""),
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
        
    pub_doc = next(
        (p for p in condition_doc.get("publications", [])
         if (p["publication"]["author"] == publication_data["author"] and 
             p["publication"]["journal"] == publication_data["journal"] and
             p["publication"]["year"] == publication_data["year"])),
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
                pub_readings = next(
                    (r["readings"] for r in group["readings"]
                     if r["publication"]["author"] == pub_data["author"]),
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
                     if p["publication"]["author"] == pub_data["author"]),
                    None
                )
                if existing_pub:
                    existing_pub["publication"] = pub_data
                    existing_pub["readings"] = pub_readings
                else:
                    target_condition["publications"].append({
                        "publication": pub_data,
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
        
@app.route("/api/materials", methods=["GET"])
def get_materials():
    element = request.args.get("element")
    doc = collection.find_one({"element": element})
    if not doc:
        return jsonify([])
    materials = [m["material"] for m in doc.get("materials", [])]
    return jsonify(materials)

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

        match_conditions = {
            "materials.pre_cor.conditions.publications.publication.author": publication["author"]
        }
        
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
                                            pub['publication']['author'] == p['author'] and
                                            pub['publication'].get('journal', '') == p.get('journal', '') and
                                            pub['publication'].get('year', '') == p.get('year', '')
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
    
if __name__ == "__main__":
    app.run(port=5001, debug=True)