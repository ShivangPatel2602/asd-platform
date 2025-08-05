#!/bin/bash

set -e  # Stop on any error

cd ~/app

# Check if .git exists
if [ ! -d ".git" ]; then
    echo "Cloning fresh repo..."
    rm -rf ~/app/*
    git clone https://github.com/ShivangPatel2602/asd-platform.git .
else
    echo "Pulling latest code..."
    git pull origin main
fi

# Backend setup
echo "Setting up backend..."
cd backend

# Create venv if not present
if [ ! -d "../venv" ]; then
    python3 -m venv ../venv
fi

source ../venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Frontend setup
cd ../frontend
echo "Installing frontend dependencies..."
npm install

echo "Building frontend..."
npm run build

# Backend server
cd ../backend

echo "Starting backend server..."
# Kill existing backend server if any
pkill -f "python app.py" || true

nohup python app.py > app.log 2>&1 &

echo "✅ Deployment complete"