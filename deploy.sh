#!/bin/bash

set -e  # Exit on error

cd ~/app || exit 1

# Pull latest code from GitHub
if [ ! -d ".git" ]; then
    git init
    git remote add origin https://github.com/ShivangPatel2602/asd-platform.git
fi

git fetch origin
git reset --hard origin/main

# Set up Python backend
echo "Setting up backend..."
cd backend

if [ ! -d "../venv" ]; then
    python3 -m venv ../venv
fi

source ../venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Set up frontend
cd ../frontend
echo "Installing frontend dependencies..."
npm install

echo "Building frontend..."
npm run build

# Start backend
cd ../backend
echo "Starting backend..."

if command -v pm2 &> /dev/null; then
    pm2 restart backend-app || pm2 start app.py --name backend-app
else
    echo "Restarting manually..."
    pkill -f "python app.py" || true
    nohup python app.py > app.log 2>&1 &
fi

echo "✅ Deployment complete"