#!/bin/bash

# Navigate to the frontend directory
cd /Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui

# Delete the node_modules/.vite directory
rm -rf node_modules/.vite

# Restart the Vite development server
npm run dev