#!/bin/bash
# Temporary wrapper script for sams-deploy until TypeScript build issues are resolved

# Get the actual directory of the sams-deploy project
SAMS_DEPLOY_DIR="/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy"

# Run the TypeScript directly with tsx
cd "$SAMS_DEPLOY_DIR" && npx tsx src/index.ts "$@"