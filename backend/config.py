import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

class Config:
    MONGO_URL = os.getenv("MONGODB_URL")
    DB_NAME = os.getenv("MONGODB_DB_NAME", "asd-platform")
    
client = MongoClient(Config.MONGO_URL)
db = client[Config.DB_NAME]

mongo_db = db