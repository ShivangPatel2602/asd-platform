import os
from dotenv import load_dotenv
from pymongo import MongoClient

env = os.getenv('FLASK_ENV', 'dev')
env_file = f'.env.{env}'
load_dotenv(env_file)

class Config:
    MONGO_URL = os.getenv("MONGODB_URL")
    DB_NAME = os.getenv("MONGODB_DB_NAME", "asd-platform")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
    EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
    
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://asd-platform-frontend.onrender.com"
    ]
    @staticmethod
    def init_app(app):
        pass
    
client = MongoClient(Config.MONGO_URL)
db = client[Config.DB_NAME]

mongo_db = db