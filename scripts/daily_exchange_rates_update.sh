#!/bin/bash

# Daily Exchange Rates Auto-Update Script
# This script runs automatically when you log in to keep exchange rates current

SCRIPT_DIR="/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts"
LOG_FILE="$SCRIPT_DIR/logs/daily_exchange_rates.log"
LOCK_FILE="$SCRIPT_DIR/logs/exchange_rates.lock"

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Function to log with timestamp
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Check if already running
if [ -f "$LOCK_FILE" ]; then
    LOCK_PID=$(cat "$LOCK_FILE")
    if ps -p "$LOCK_PID" > /dev/null 2>&1; then
        log_message "Exchange rates update already running (PID: $LOCK_PID)"
        exit 0
    else
        log_message "Removing stale lock file"
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"

log_message "=== Starting daily exchange rates update ==="

# Change to script directory
cd "$SCRIPT_DIR" || {
    log_message "ERROR: Could not change to script directory: $SCRIPT_DIR"
    rm -f "$LOCK_FILE"
    exit 1
}

# Run the quick update (which will fill gaps if any exist)
log_message "Running quick update to fill any gaps..."
if node updateExchangeRates.js >> "$LOG_FILE" 2>&1; then
    log_message "✅ Daily exchange rates update completed successfully"
else
    log_message "❌ Daily exchange rates update failed"
fi

log_message "=== Daily exchange rates update finished ==="

# Remove lock file
rm -f "$LOCK_FILE"

# Keep only last 30 days of logs
find "$SCRIPT_DIR/logs" -name "daily_exchange_rates.log.*" -mtime +30 -delete 2>/dev/null || true

# Rotate log if it's getting large (> 1MB)
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || echo 0) -gt 1048576 ]; then
    mv "$LOG_FILE" "$LOG_FILE.$(date +%Y%m%d_%H%M%S)"
    log_message "Log rotated due to size"
fi
