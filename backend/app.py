from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from config import Config

app = Flask(__name__)
CORS(app)

client = MongoClient(Config.MONGO_URL)
db = client.get_database()

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "Backend is running"}), 200

@app.route("/api/data", methods=["POST"])
def add_data():
    data = request.get_json()
    db.entries.insert_one(data)
    return jsonify({"message": "Data added!"}), 201

if __name__ == "__main__":
    app.run(debug=True)