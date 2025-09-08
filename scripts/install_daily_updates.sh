#!/bin/bash

# Installation script for SAMS Exchange Rates Daily Auto-Update
# This sets up automatic daily exchange rate updates on login

SCRIPT_DIR="/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts"
PLIST_FILE="com.sams.exchangerates.daily.plist"
LAUNCHAGENTS_DIR="/Users/michael/Library/LaunchAgents"

echo "🔧 Setting up SAMS Exchange Rates Daily Auto-Update..."

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCHAGENTS_DIR"

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"

# Copy the plist file to LaunchAgents
echo "📋 Installing LaunchAgent..."
cp "$SCRIPT_DIR/$PLIST_FILE" "$LAUNCHAGENTS_DIR/"

# Load the LaunchAgent
echo "🚀 Loading LaunchAgent..."
launchctl load "$LAUNCHAGENTS_DIR/$PLIST_FILE"

# Check if it loaded successfully
if launchctl list | grep -q "com.sams.exchangerates.daily"; then
    echo "✅ LaunchAgent loaded successfully"
    echo ""
    echo "📅 Daily exchange rates updates are now configured to run:"
    echo "   • On login"
    echo "   • Every 24 hours"
    echo "   • Automatically fill gaps if any exist"
    echo ""
    echo "📁 Logs will be saved to:"
    echo "   $SCRIPT_DIR/logs/"
    echo ""
    echo "🎛️ To manually run an update:"
    echo "   cd '$SCRIPT_DIR'"
    echo "   node updateExchangeRates.js"
    echo ""
    echo "🛑 To stop the automatic updates:"
    echo "   launchctl unload '$LAUNCHAGENTS_DIR/$PLIST_FILE'"
    echo ""
    echo "🔄 To restart the automatic updates:"
    echo "   launchctl load '$LAUNCHAGENTS_DIR/$PLIST_FILE'"
else
    echo "❌ Failed to load LaunchAgent"
    echo "You may need to check system permissions or run this script with appropriate privileges"
    exit 1
fi

echo ""
echo "🎉 Setup complete! Exchange rates will update automatically."
