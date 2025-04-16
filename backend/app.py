from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from config import Config

app = Flask(__name__)
CORS(app)

client = MongoClient(Config.MONGO_URL)
db = client.get_database(Config.DB_NAME)
collection = db["asd-platform"]

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "Backend is running"}), 200

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

if __name__ == "__main__":
    app.run(debug=True)