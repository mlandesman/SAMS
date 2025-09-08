# SAMS Exchange Rates Daily Auto-Update Setup Guide

## Overview
This system automatically keeps exchange rates current by running daily updates that detect and fill gaps in your data.

## Quick Setup

### Option 1: Automatic Setup (Recommended)
Run the installation script to set up automatic daily updates:

```bash
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts"
./install_daily_updates.sh
```

This will:
- ✅ Install a macOS LaunchAgent for automatic updates
- ✅ Configure daily execution (on login + every 24 hours)
- ✅ Set up logging to track updates
- ✅ Enable gap detection and filling

### Option 2: Manual Setup
If you prefer manual control:

```bash
# Run daily update manually
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts"
node updateExchangeRates.js
```

## How It Works

### Daily Update Process:
1. **Quick Update First**: Attempts to update from last known date to today
2. **Gap Detection**: Automatically identifies missing weekdays
3. **Gap Filling**: If gaps exist, fills them using individual API calls
4. **Fallback Strategy**: If quick update fails, tries gap-filling for last 30 days
5. **Graceful Handling**: Handles API 404 errors and network issues

### Smart Features:
- ✅ **Weekdays Only**: Automatically skips weekends and holidays
- ✅ **No Duplicates**: Checks existing data before importing
- ✅ **Multi-Currency**: Updates USD, CAD, EUR, COP rates
- ✅ **Error Recovery**: Multiple fallback strategies
- ✅ **Logging**: Detailed logs for monitoring

## File Structure

```
scripts/
├── bulkImportExchangeRates.js          # Main import script
├── updateExchangeRates.js              # Daily update wrapper
├── daily_exchange_rates_update.sh     # Login automation script
├── install_daily_updates.sh           # Setup script
├── com.sams.exchangerates.daily.plist # macOS LaunchAgent config
└── logs/                              # Log files directory
    ├── daily_exchange_rates.log       # Daily update logs
    ├── launchagent.log               # LaunchAgent output
    └── launchagent_error.log         # LaunchAgent errors
```

## Manual Commands

### Check Status
```bash
# Check if LaunchAgent is running
launchctl list | grep com.sams.exchangerates.daily

# View recent logs
tail -f "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/logs/daily_exchange_rates.log"
```

### Stop/Start Automatic Updates
```bash
# Stop automatic updates
launchctl unload "/Users/michael/Library/LaunchAgents/com.sams.exchangerates.daily.plist"

# Start automatic updates
launchctl load "/Users/michael/Library/LaunchAgents/com.sams.exchangerates.daily.plist"
```

### Manual Updates
```bash
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts"

# Quick daily update
node updateExchangeRates.js

# Fill gaps only (preserves existing data)
node bulkImportExchangeRates.js --fill-gaps

# Test what would be updated
node bulkImportExchangeRates.js --dry-run --fill-gaps

# Full replacement (use only when needed)
node bulkImportExchangeRates.js --full-replacement
```

## Monitoring

### Check Logs
- **Daily Update Logs**: `logs/daily_exchange_rates.log`
- **LaunchAgent Output**: `logs/launchagent.log`
- **LaunchAgent Errors**: `logs/launchagent_error.log`

### Log Rotation
- Logs automatically rotate when > 1MB
- Old logs are cleaned up after 30 days
- Lock files prevent overlapping runs

## Troubleshooting

### If Updates Aren't Running:
1. Check LaunchAgent status: `launchctl list | grep com.sams.exchangerates.daily`
2. Check permissions on script files
3. Check logs for error messages
4. Manually run `node updateExchangeRates.js` to test

### If Getting 404 API Errors:
- This is normal for very recent dates (like today)
- The system will retry on the next run
- Historical data import works fine with bulk approach

### If Network Issues:
- The system handles network failures gracefully
- Will retry on next scheduled run
- Check logs for specific error details

## Next Steps After Setup

1. **Verify Installation**: Run `./install_daily_updates.sh`
2. **Test Manual Update**: Run `node updateExchangeRates.js`
3. **Monitor First Few Days**: Check logs to ensure smooth operation
4. **Adjust Schedule**: Modify plist file if needed for different timing

The system is designed to be "set and forget" - once installed, it will keep your exchange rates current automatically!
