#!/usr/bin/env bash
# Phase 2 bootstrap: topic, push subscription with backoff retry, and dead-letter topic.
# Run AFTER the first deploy of contexto-worker (needs the service to grant run.invoker on it).
# Superseded by infra/modules/pubsub in Phase 3.
set -euo pipefail
: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
WORKER_URL=$(gcloud run services describe contexto-worker --region "$REGION" --format='value(status.url)')
PUSH_SA="contexto-pubsub-push@$PROJECT_ID.iam.gserviceaccount.com"
PUBSUB_AGENT="serviceAccount:service-$PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com"

gcloud pubsub topics describe ingest-requests >/dev/null 2>&1 || gcloud pubsub topics create ingest-requests
gcloud pubsub topics describe ingest-dlq >/dev/null 2>&1 || gcloud pubsub topics create ingest-dlq
gcloud pubsub subscriptions describe ingest-dlq-pull >/dev/null 2>&1 || \
  gcloud pubsub subscriptions create ingest-dlq-pull --topic ingest-dlq --message-retention-duration=7d

gcloud iam service-accounts describe "$PUSH_SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create contexto-pubsub-push --display-name "Pub/Sub push identity"
gcloud run services add-iam-policy-binding contexto-worker --region "$REGION" \
  --member="serviceAccount:$PUSH_SA" --role=roles/run.invoker >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$PUSH_SA" \
  --member="$PUBSUB_AGENT" --role=roles/iam.serviceAccountTokenCreator >/dev/null

# Backend may publish to the ingest topic only.
gcloud pubsub topics add-iam-policy-binding ingest-requests \
  --member="serviceAccount:contexto-backend@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/pubsub.publisher >/dev/null

# Dead-lettering: Pub/Sub must be able to publish to the DLQ and ack from the source subscription.
gcloud pubsub topics add-iam-policy-binding ingest-dlq --member="$PUBSUB_AGENT" --role=roles/pubsub.publisher >/dev/null

SUB_ARGS=(--topic ingest-requests --push-endpoint "$WORKER_URL/"
  --push-auth-service-account "$PUSH_SA" --push-auth-token-audience "$WORKER_URL"
  --ack-deadline 300
  --min-retry-delay 10s --max-retry-delay 600s   # exponential backoff between redeliveries
  --dead-letter-topic ingest-dlq --max-delivery-attempts 5)
if gcloud pubsub subscriptions describe ingest-requests-push >/dev/null 2>&1; then
  gcloud pubsub subscriptions update ingest-requests-push "${SUB_ARGS[@]:2}"
else
  gcloud pubsub subscriptions create ingest-requests-push "${SUB_ARGS[@]}"
fi
gcloud pubsub subscriptions add-iam-policy-binding ingest-requests-push \
  --member="$PUBSUB_AGENT" --role=roles/pubsub.subscriber >/dev/null
echo "Pub/Sub wired: ingest-requests -> $WORKER_URL (DLQ: ingest-dlq)"
