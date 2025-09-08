#!/bin/bash

# Get the project ID
PROJECT_ID="sams-sandyland-prod"

# Get the project number
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")

# Cloud Functions service accounts
GCF_SERVICE_ACCOUNT="${PROJECT_NUMBER}@gcf-admin-robot.iam.gserviceaccount.com"
COMPUTE_SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Setting up permissions for project: ${PROJECT_ID}"
echo "Project number: ${PROJECT_NUMBER}"
echo "Cloud Functions service account: ${GCF_SERVICE_ACCOUNT}"

# Grant Artifact Registry Reader role to Cloud Functions service account
echo "Granting Artifact Registry permissions..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${GCF_SERVICE_ACCOUNT}" \
    --role="roles/artifactregistry.reader"

# Grant additional permissions that might be needed
echo "Granting additional Cloud Functions permissions..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${GCF_SERVICE_ACCOUNT}" \
    --role="roles/cloudfunctions.serviceAgent"

# Grant permissions for the compute service account (runtime)
echo "Granting runtime permissions..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${COMPUTE_SERVICE_ACCOUNT}" \
    --role="roles/datastore.user"

echo "Permissions setup complete!"
echo ""
echo "Please wait a few minutes for the permissions to propagate, then try deploying again."