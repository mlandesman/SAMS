#!/bin/bash

# Setup script to create the shared GCS backup bucket
# Usage: ./setup-gcs-bucket.sh

set -e

BUCKET_NAME="sams-shared-backups"
LOCATION="us-central1"
PROJECT_ID="sams-sandyland-prod"

echo "🪣 Setting up GCS backup bucket: $BUCKET_NAME"
echo "=============================================="
echo ""

# Check if bucket already exists
if gsutil ls -b "gs://${BUCKET_NAME}" >/dev/null 2>&1; then
    echo "✅ Bucket $BUCKET_NAME already exists"
else
    echo "📦 Creating bucket $BUCKET_NAME..."
    gsutil mb -p "$PROJECT_ID" -c STANDARD -l "$LOCATION" "gs://${BUCKET_NAME}"
    echo "✅ Bucket created successfully"
fi

# Set lifecycle policy (auto-delete after 30 days for non-tagged backups)
echo ""
echo "📋 Setting lifecycle policy..."
cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 30,
          "matchesPrefix": ["firestore/", "storage/"],
          "matchesSuffix": ["_nightly/"]
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set /tmp/lifecycle.json "gs://${BUCKET_NAME}"
rm /tmp/lifecycle.json
echo "✅ Lifecycle policy set (auto-delete after 30 days for nightly backups)"

# Set IAM permissions
echo ""
echo "🔐 Configuring IAM permissions..."

# Get service account emails
PROD_SA=$(gcloud iam service-accounts list --project="$PROJECT_ID" --filter="displayName:App Engine default service account" --format="value(email)" | head -1)
DEV_PROJECT_ID="sandyland-management-system"
DEV_SA=$(gcloud iam service-accounts list --project="$DEV_PROJECT_ID" --filter="displayName:App Engine default service account" --format="value(email)" | head -1)

# Get compute service accounts (used by Firestore import/export)
PROD_PROJECT_NUM=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" 2>/dev/null)
DEV_PROJECT_NUM=$(gcloud projects describe "$DEV_PROJECT_ID" --format="value(projectNumber)" 2>/dev/null)

if [ -n "$PROD_SA" ]; then
    echo "   Granting storage.objectAdmin to $PROD_SA"
    gsutil iam ch "serviceAccount:${PROD_SA}:roles/storage.objectAdmin" "gs://${BUCKET_NAME}"
fi

if [ -n "$DEV_SA" ]; then
    echo "   Granting storage.objectAdmin to $DEV_SA"
    gsutil iam ch "serviceAccount:${DEV_SA}:roles/storage.objectAdmin" "gs://${BUCKET_NAME}"
fi

# Grant permissions to compute service accounts (required for Firestore import/export)
if [ -n "$PROD_PROJECT_NUM" ]; then
    PROD_COMPUTE_SA="${PROD_PROJECT_NUM}-compute@developer.gserviceaccount.com"
    echo "   Granting storage.objectViewer to $PROD_COMPUTE_SA (for Firestore operations)"
    gsutil iam ch "serviceAccount:${PROD_COMPUTE_SA}:roles/storage.objectViewer" "gs://${BUCKET_NAME}" 2>/dev/null || echo "     (May already have permission)"
fi

if [ -n "$DEV_PROJECT_NUM" ]; then
    DEV_COMPUTE_SA="${DEV_PROJECT_NUM}-compute@developer.gserviceaccount.com"
    echo "   Granting storage.objectViewer to $DEV_COMPUTE_SA (for Firestore operations)"
    gsutil iam ch "serviceAccount:${DEV_COMPUTE_SA}:roles/storage.objectViewer" "gs://${BUCKET_NAME}" 2>/dev/null || echo "     (May already have permission)"
fi

# Also grant datastore.importExportAdmin role at project level
echo ""
echo "🔐 Granting Firestore import/export permissions..."
if [ -n "$PROD_SA" ]; then
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${PROD_SA}" \
        --role="roles/datastore.importExportAdmin" \
        --condition=None 2>/dev/null || echo "   (May already have permission)"
fi

if [ -n "$DEV_SA" ]; then
    gcloud projects add-iam-policy-binding "$DEV_PROJECT_ID" \
        --member="serviceAccount:${DEV_SA}" \
        --role="roles/datastore.importExportAdmin" \
        --condition=None 2>/dev/null || echo "   (May already have permission)"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Run ./backup-prod.sh to create your first backup"
echo "   2. Verify backup with ./list-backups.sh"

