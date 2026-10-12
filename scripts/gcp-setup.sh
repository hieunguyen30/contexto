#!/usr/bin/env bash
# One-time Phase 1 bootstrap. Superseded by Terraform in Phase 3.
# Usage: PROJECT_ID=my-proj REGION=us-central1 ./scripts/gcp-setup.sh
set -euo pipefail
: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
gcloud config set project "$PROJECT_ID"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com pubsub.googleapis.com storage.googleapis.com

gcloud artifacts repositories describe contexto --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create contexto --repository-format=docker --location "$REGION"

# Runtime identities: backend may only read its secrets; frontend needs no roles (it holds no secrets).
for sa in contexto-backend contexto-frontend contexto-worker; do
  gcloud iam service-accounts describe "$sa@$PROJECT_ID.iam.gserviceaccount.com" >/dev/null 2>&1 || \
    gcloud iam service-accounts create "$sa"
done

# Secrets: values are read from the environment (MONGODB_URI, OPENAI_API_KEY, ANTHROPIC_API_KEY).
for name in MONGODB_URI OPENAI_API_KEY ANTHROPIC_API_KEY; do
  gcloud secrets describe "$name" >/dev/null 2>&1 || gcloud secrets create "$name" --replication-policy=automatic
  if [ -n "${!name:-}" ]; then printf '%s' "${!name}" | gcloud secrets versions add "$name" --data-file=-; fi
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:contexto-backend@$PROJECT_ID.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor >/dev/null
done
# The worker needs the DB and embedding secrets, but not the Claude key.
for name in MONGODB_URI OPENAI_API_KEY; do
  gcloud secrets add-iam-policy-binding "$name" \n    --member="serviceAccount:contexto-worker@$PROJECT_ID.iam.gserviceaccount.com" \n    --role=roles/secretmanager.secretAccessor >/dev/null
done

# Raw text bucket (Phase 2). Backend reads it for vocab extraction; worker writes it.
BUCKET="$PROJECT_ID-contexto-raw-text"
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 || \n  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access
for sa in contexto-backend contexto-worker; do
  gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \n    --member="serviceAccount:$sa@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/storage.objectUser >/dev/null
done


# Cloud Build's service account: push images, deploy Cloud Run, act as the runtime SAs.
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB_SA="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
for role in roles/artifactregistry.writer roles/run.admin roles/logging.logWriter roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="$CB_SA" --role="$role" >/dev/null
done
for sa in contexto-backend contexto-frontend contexto-worker; do
  gcloud iam service-accounts add-iam-policy-binding "$sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --member="$CB_SA" --role=roles/iam.serviceAccountUser >/dev/null
done

echo "Done. Deploy with:"
echo "  gcloud builds submit --config cloudbuild.yaml --substitutions=_PROJECT_NUMBER=$PROJECT_NUMBER,_RAW_TEXT_BUCKET=$BUCKET,_REGION=$REGION,SHORT_SHA=\$(git rev-parse --short HEAD)"
echo "Note: SHORT_SHA is only auto-populated for trigger builds; pass it explicitly for manual submits."
