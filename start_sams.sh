#!/bin/bash

# SAMS Project Startup Script
# This script starts both the backend and frontend servers for the SAMS project

MAIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$MAIN_DIR/backend"
FRONTEND_DIR="$MAIN_DIR/frontend/sams-ui"
PWA_DIR="$MAIN_DIR/frontend/mobile-app"

echo "======================================================"
echo "📁 SAMS Project Directory: $MAIN_DIR"
echo "======================================================"

# Function to check if a process is running on a specific port
check_port() {
  local port="$1"
  lsof -i:"$port" > /dev/null 2>&1
  return $?
}

# Function to kill processes running on a specific port
kill_port() {
  local port="$1"
  local service="$2"
  if check_port "$port"; then
    echo "🛑 Stopping existing $service on port $port..."
    lsof -ti:$port | xargs kill -9
    sleep 1
    if ! check_port "$port"; then
      echo "✅ Successfully stopped $service on port $port"
    else
      echo "⚠️ Failed to stop $service on port $port"
    fi
  fi
}

# Function to start backend server
start_backend() {
  echo "🔄 Starting backend server..."
  cd "$BACKEND_DIR" || { echo "❌ Unable to access backend directory"; exit 1; }
  
  # Kill any existing backend server
  kill_port 5001 "backend server"
  
  echo "🚀 Starting backend server on port 5001"
  npm start &
  BACKEND_PID=$!
  echo "✅ Backend server started with PID: $BACKEND_PID"
  echo "📝 Backend server logs will appear in this terminal"
}



# Function to start frontend server
start_frontend() {
  echo "🔄 Starting frontend server..."
  cd "$FRONTEND_DIR" || { echo "❌ Unable to access frontend directory"; exit 1; }
  
  # Kill any existing frontend server
  kill_port 5173 "frontend server"
  
  # Check for .vite directory and clean if necessary
  if [ -d "node_modules/.vite" ]; then
    echo "🧹 Cleaning Vite cache..."
    rm -rf node_modules/.vite
  fi
  
  echo "🚀 Starting frontend Vite dev server"
  npm run dev &
  FRONTEND_PID=$!
  echo "✅ Frontend server started with PID: $FRONTEND_PID"
  echo "📝 Frontend server logs will appear in this terminal"
}

# Function to start PWA mobile app
start_pwa() {
  echo "🔄 Starting PWA mobile app..."
  cd "$PWA_DIR" || { echo "❌ Unable to access PWA directory"; exit 1; }
  
  # Kill any existing PWA server
  kill_port 5174 "PWA mobile app"
  
  # Check for .vite directory and clean if necessary
  if [ -d "node_modules/.vite" ]; then
    echo "🧹 Cleaning PWA Vite cache..."
    rm -rf node_modules/.vite
  fi
  
  echo "🚀 Starting PWA mobile app on port 5174"
  npm run dev &
  PWA_PID=$!
  echo "✅ PWA mobile app started with PID: $PWA_PID"
  echo "📝 PWA mobile app logs will appear in this terminal"
}

# Main execution
echo "🔍 Checking environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed. Please install Node.js and try again."
  exit 1
fi
echo "✅ Node.js $(node -v) is installed"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "❌ npm is not installed. Please install npm and try again."
  exit 1
fi
echo "✅ npm $(npm -v) is installed"

# Check if Firebase CLI is installed - not needed for production mode
echo "💡 Using production Firebase (no emulators needed)"
SKIP_FIREBASE=true

# Start servers
echo ""
echo "🔄 Starting SAMS services..."
echo ""

# Start backend in background
start_backend

# Give the backend a moment to start
sleep 2

# Start frontend
start_frontend

# Give the frontend a moment to start
sleep 2

# Start PWA mobile app
start_pwa

# Give the PWA frontend a moment to start
sleep 4

echo ""
echo "======================================================"
echo "🌐 Services Status:"
echo "   Backend: http://localhost:5001"
echo "   Frontend: http://localhost:5173"
echo "   PWA Mobile App: http://localhost:5174"
echo "======================================================"
echo ""
echo "💡 Press Ctrl+C to stop all services"

# Trap Ctrl+C and properly terminate all processes
cleanup() {
  echo ""
  echo "🛑 Stopping all services..."
  kill_port 5001 "backend server"
  kill_port 5173 "frontend server"
  kill_port 5174 "PWA mobile app"
  echo "✅ All services stopped"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Keep the script running until user presses Ctrl+C
wait
trap "echo '🛑 Stopping all services...'; pkill -P $$; exit" INT
wait
