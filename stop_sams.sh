#!/bin/bash

# SAMS Project Stop Script
# This script stops both the backend and frontend servers for the SAMS project

echo "======================================================"
echo "🛑 SAMS Services - Stopping Servers"
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
    echo "🛑 Stopping $service on port $port..."
    lsof -ti:$port | xargs kill -9
    sleep 1
    if ! check_port "$port"; then
      echo "✅ Successfully stopped $service on port $port"
    else
      echo "⚠️ Failed to stop $service on port $port"
    fi
  else
    echo "ℹ️ No $service running on port $port"
  fi
}

# Stop backend (port 5001)
kill_port 5001 "backend server"

# Stop frontend (port 5173)
kill_port 5173 "frontend server"

# Stop PWA mobile app (port 5174)
kill_port 5174 "PWA mobile app"

# Stop Firebase emulators
kill_port 8001 "Firebase Functions emulator"
kill_port 8080 "Firebase Firestore emulator"
kill_port 4000 "Firebase Emulator UI"

echo ""
echo "======================================================"
echo "🌐 Services Status:"
echo "   All SAMS services have been stopped"
echo "======================================================"
