#!/bin/bash
# Quick deploy script for SAMS Mobile

echo "🚀 Deploying SAMS Mobile to Vercel..."
cd "$(dirname "$0")"

# Use full path to vercel
/Users/michael/.npm-global/bin/vercel "$@"