#!/bin/bash

echo "🚀 Starting Water Meter API Tests"
echo "================================"
echo ""

# Kill any existing backend process
echo "🔄 Cleaning up existing processes..."
pkill -f "node index.js" 2>/dev/null

# Start backend in background
echo "🌟 Starting backend server..."
cd /Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS/backend
npm run dev > backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
sleep 3

# Check if backend started successfully
if ! ps -p $BACKEND_PID > /dev/null; then
    echo "❌ Backend failed to start. Check backend.log for details."
    exit 1
fi

# Run the quick test
echo ""
echo "🧪 Running Quick Water Meter Test..."
echo "================================"
node testing/quickWaterMeterTest.js

TEST_EXIT_CODE=$?

# Kill backend
echo ""
echo "🛑 Stopping backend server..."
kill $BACKEND_PID 2>/dev/null

echo ""
echo "✅ Test run complete!"

# Exit with test exit code
exit $TEST_EXIT_CODE