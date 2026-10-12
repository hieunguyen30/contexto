#!/usr/bin/env bash
# Creates the versioned GCS bucket that holds Terraform state for one environment.
# Usage: PROJECT_ID=my-proj BUCKET=my-proj-tfstate ./scripts/tf-bootstrap.sh
set -euo pipefail
: "${PROJECT_ID:?}" ; : "${BUCKET:?}"
REGION="${REGION:-us-central1}"
gcloud storage buckets describe "gs://$BUCKET" --project "$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT_ID" --location "$REGION" \
    --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update "gs://$BUCKET" --versioning
echo "State bucket ready. Put it in infra/envs/<env>/backend.hcl, then:"
echo "  cd infra/envs/<env> && terraform init -backend-config=backend.hcl && terraform plan -var-file=<env>.tfvars"
