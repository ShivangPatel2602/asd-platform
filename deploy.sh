#!/bin/bash

# Navigate to the app directory
cd ~/app

echo "Pulling latest code..."
git pull origin main

echo "Installing backend dependencies..."
cd backend
source ../venv/bin/activate  # only if using a virtual environment
pip install -r requirements.txt

echo "Restarting backend server..."
pm2 restart backend-app  # or gunicorn/systemd

echo "Installing frontend dependencies..."
cd ../frontend
npm install

echo "Building frontend..."
npm run build

echo "Deployment complete ✅"
