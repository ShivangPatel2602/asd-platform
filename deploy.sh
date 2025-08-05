#!/bin/bash

# Navigate to the app directory
cd ~/app

echo "Checking if git repository exists..."
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git remote add origin https://github.com/ShivangPatel2602/asd-platform.git
fi

echo "Pulling latest code..."
git pull origin main

echo "Installing backend dependencies..."
cd backend
# Check if virtual environment exists
if [ -d "../venv" ]; then
    source ../venv/bin/activate
fi
pip install -r requirements.txt

echo "Installing frontend dependencies..."
cd ../frontend
npm install

echo "Building frontend..."
npm run build

echo "Restarting backend server..."
# Try different restart methods
if command -v pm2 &> /dev/null; then
    echo "Using PM2 to restart..."
    pm2 restart backend-app || pm2 start app.py --name backend-app
elif command -v systemctl &> /dev/null; then
    echo "Using systemctl to restart..."
    sudo systemctl restart your-app || echo "Service not found, starting manually..."
    cd ../backend
    nohup python app.py > app.log 2>&1 &
else
    echo "No PM2 or systemctl found, starting manually..."
    cd ../backend
    pkill -f "python app.py" || true
    nohup python app.py > app.log 2>&1 &
fi

echo "Deployment complete ✅"