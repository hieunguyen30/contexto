# Exports structured app logs (requests, LLM usage/cost, quiz attempts, ingestion outcomes) to BigQuery.
# Cloud Run stdout lands in the table `run_googleapis_com_stdout`, created on the first matching log entry.
variable "project_id" { type = string }
variable "location" {
  type    = string
  default = "US"
}
variable "dataset_id" {
  type    = string
  default = "contexto_logs"
}
variable "default_table_expiration_days" {
  description = "Partitions older than this are dropped (cost control). 0 = keep forever."
  type        = number
  default     = 90
}

resource "google_bigquery_dataset" "logs" {
  project    = var.project_id
  dataset_id = var.dataset_id
  location   = var.location
  # Partition expiry is applied per table below via the sink's partitioned tables.
  default_partition_expiration_ms = var.default_table_expiration_days > 0 ? var.default_table_expiration_days * 86400000 : null
}

resource "google_logging_project_sink" "to_bigquery" {
  project                = var.project_id
  name                   = "contexto-app-logs-to-bq"
  destination            = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${google_bigquery_dataset.logs.dataset_id}"
  unique_writer_identity = true

  filter = <<-EOT
    resource.type="cloud_run_revision"
    jsonPayload.message=("request_complete" OR "llm_usage" OR "quiz_attempt" OR "ingest_complete" OR "ingest_failed")
  EOT

  bigquery_options {
    use_partitioned_tables = true
  }
}

# The sink's identity may write to this dataset only.
resource "google_bigquery_dataset_iam_member" "sink_writer" {
  project    = var.project_id
  dataset_id = google_bigquery_dataset.logs.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.to_bigquery.writer_identity
}

output "dataset_id" { value = google_bigquery_dataset.logs.dataset_id }
