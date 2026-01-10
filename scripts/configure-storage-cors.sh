#!/bin/bash

# Configure CORS for Google Cloud Storage buckets to allow client uploads
# This is required for signed URL uploads to work from the frontend

set -e

BUCKET_NAME="${1:-sandyland-management-system.firebasestorage.app}"
CORS_CONFIG="${2:-cors.json}"

if [ ! -f "$CORS_CONFIG" ]; then
  echo "❌ Error: CORS config file not found: $CORS_CONFIG"
  echo "Usage: $0 [BUCKET_NAME] [CORS_CONFIG_FILE]"
  exit 1
fi

echo "📤 Configuring CORS for bucket: $BUCKET_NAME"
echo "📄 Using CORS config: $CORS_CONFIG"
echo ""

# Apply CORS configuration using gsutil
gsutil cors set "$CORS_CONFIG" "gs://$BUCKET_NAME"

echo "✅ CORS configuration applied successfully!"
echo ""
echo "Note: If you have multiple buckets (dev/staging/prod), run this for each:"
echo "  $0 sandyland-management-system.firebasestorage.app"
echo "  $0 sams-staging-6cdcd.firebasestorage.app"
echo "  $0 sams-sandyland-prod.firebasestorage.app"
