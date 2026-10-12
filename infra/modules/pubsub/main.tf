variable "project_id" { type = string }
variable "push_endpoint" {
  description = "Worker URL that receives pushes (also used as OIDC audience)."
  type        = string
}
variable "push_service_account_email" { type = string }
variable "publisher_emails" {
  description = "Service accounts allowed to publish to the ingest topic."
  type        = list(string)
}
variable "max_delivery_attempts" {
  type    = number
  default = 5
}
variable "ack_deadline_seconds" {
  type    = number
  default = 300
}

data "google_project" "this" {
  project_id = var.project_id
}

locals {
  pubsub_agent = "serviceAccount:service-${data.google_project.this.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_topic" "ingest" {
  project = var.project_id
  name    = "ingest-requests"
}

resource "google_pubsub_topic" "dlq" {
  project = var.project_id
  name    = "ingest-dlq"
}

# Pull subscription keeps dead-lettered messages inspectable and replayable.
resource "google_pubsub_subscription" "dlq_pull" {
  project                    = var.project_id
  name                       = "ingest-dlq-pull"
  topic                      = google_pubsub_topic.dlq.id
  message_retention_duration = "604800s"
  ack_deadline_seconds       = 60
}

resource "google_pubsub_subscription" "ingest_push" {
  project              = var.project_id
  name                 = "ingest-requests-push"
  topic                = google_pubsub_topic.ingest.id
  ack_deadline_seconds = var.ack_deadline_seconds

  push_config {
    push_endpoint = "${var.push_endpoint}/"
    oidc_token {
      service_account_email = var.push_service_account_email
      audience              = var.push_endpoint
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = var.max_delivery_attempts
  }
}

resource "google_pubsub_topic_iam_member" "publishers" {
  for_each = toset(var.publisher_emails)
  project  = var.project_id
  topic    = google_pubsub_topic.ingest.name
  role     = "roles/pubsub.publisher"
  member   = "serviceAccount:${each.value}"
}

# Dead-lettering needs the Pub/Sub service agent to publish to the DLQ and ack the source subscription.
resource "google_pubsub_topic_iam_member" "dlq_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.dlq.name
  role    = "roles/pubsub.publisher"
  member  = local.pubsub_agent
}

resource "google_pubsub_subscription_iam_member" "source_subscriber" {
  project      = var.project_id
  subscription = google_pubsub_subscription.ingest_push.name
  role         = "roles/pubsub.subscriber"
  member       = local.pubsub_agent
}

# Let Pub/Sub mint OIDC tokens as the push identity.
resource "google_service_account_iam_member" "token_creator" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${var.push_service_account_email}"
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.pubsub_agent
}

output "ingest_topic" { value = google_pubsub_topic.ingest.name }
output "dlq_topic" { value = google_pubsub_topic.dlq.name }
output "ingest_subscription" { value = google_pubsub_subscription.ingest_push.name }
output "dlq_subscription" { value = google_pubsub_subscription.dlq_pull.name }
