# Triggers a Cloud Run job on a cron schedule via the Cloud Run Admin API.
variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }
variable "schedule" { type = string }
variable "time_zone" {
  type    = string
  default = "Etc/UTC"
}
variable "job_name" { type = string }
variable "service_account_email" { type = string }

resource "google_cloud_scheduler_job" "this" {
  project   = var.project_id
  region    = var.region
  name      = var.name
  schedule  = var.schedule
  time_zone = var.time_zone

  retry_config {
    retry_count = 3
  }

  http_target {
    http_method = "POST"
    uri         = "https://run.googleapis.com/v2/projects/${var.project_id}/locations/${var.region}/jobs/${var.job_name}:run"
    oauth_token {
      service_account_email = var.service_account_email
    }
  }
}

# The scheduler identity may run exactly this job.
resource "google_cloud_run_v2_job_iam_member" "runner" {
  project  = var.project_id
  location = var.region
  name     = var.job_name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.service_account_email}"
}
