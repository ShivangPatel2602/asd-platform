from flask import Flask, jsonify, request, redirect, url_for, session
from authlib.integrations.flask_client import OAuth
from flask_cors import CORS
from pymongo import MongoClient
from config import Config
from flask_mail import Mail, Message
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'super_secret_dev_key'
CORS(
    app, 
    supports_credentials=True, 
    resources={
        r"/api/*": {
            "origins": Config.ALLOWED_ORIGINS,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "expose_headers": ["Content-Range", "X-Content-Range"],
            "suppport_credentials": True
        }
    })

app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=timedelta(days=7)
)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'https://asd-platform-frontend.onrender.com')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

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
    # access_token_params=None,
    # authorize_url='https://accounts.google.com/o/oauth2/v2/auth',
    # authorize_params={'access_type': 'offline'},
    # api_base_url='https://www.googleapis.com/oauth2/v2/',
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
    print("Entered user route")
    user = session.get('user')
    print("User info", user)
    return jsonify(user) if user else ('Unauthorized', 401)

@app.route("/logout", methods=["GET"])
def logout():
    session.clear()
    return "logged out", 200

@app.route("/api/data", methods=["POST"])
def add_data():
    data = request.get_json()
    
    element = data.get("element")
    material = data.get("material")
    precursor = data.get("precursor")
    coreactant = data.get("coreactant")
    surface = data.get("surface")
    pretreatment = data.get("pretreatment")
    temperature = data.get("temperature")
    publication = data.get("publication")
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
        collection.insert_one(element_doc)
        
    # Step 02: Checking if material exists under the element
    material_doc = next((m for m in element_doc["materials"] if m["material"] == material), None)
    if not material_doc:
        material_doc = {
            "material": material,
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
    condition_doc = next((c for c in pair_doc["conditions"] if c["surface"] == surface and c["pretreatment"] == pretreatment and c["temperature"] == temperature), None)
    if not condition_doc:
        condition_doc = {
            "surface": surface,
            "pretreatment": pretreatment,
            "temperature": temperature,
            "publications": []
        }
        pair_doc["conditions"].append(condition_doc)
        
    # Step 05: Check if publication exists and add readings
    condition_doc["publications"].append({
        "publication": publication,
        "readings": readings
    })
    
    element_doc.pop("_id", None)
    collection.replace_one({"element": element}, element_doc, upsert=True)
    
    return jsonify({"message": "Data added successfully"}), 201

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

@app.route("/api/readings", methods=["GET"])
def get_readings():
    element = request.args.get("element")
    material = request.args.get("material")
    precursor = request.args.get("precursor")
    coreactant = request.args.get("coreactant")
    surface = request.args.get("surface")
    pretreatment = request.args.get("pretreatment")
    publication = request.args.get("publication")
    
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

    publication_doc = next((p for p in condition_doc.get("publications", []) if p["publication"] == publication), None)
    if not publication_doc:
        return jsonify([])

    readings = publication_doc.get("readings", [])
    
    return jsonify(readings)

if __name__ == "__main__":
    app.run(debug=True)