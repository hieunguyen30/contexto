variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }
variable "service_account_email" { type = string }
variable "image" { type = string }
variable "env" {
  type    = map(string)
  default = {}
}
variable "secret_env" {
  description = "ENV_VAR => secret_id (latest version)."
  type        = map(string)
  default     = {}
}
variable "public" {
  description = "Allow unauthenticated invocation."
  type        = bool
  default     = false
}
variable "invokers" {
  description = "Service account emails granted run.invoker (for non-public services)."
  type        = list(string)
  default     = []
}
variable "min_instances" {
  type    = number
  default = 0
}
variable "max_instances" {
  type    = number
  default = 5
}
variable "cpu" {
  type    = string
  default = "1"
}
variable "memory" {
  type    = string
  default = "512Mi"
}
variable "concurrency" {
  type    = number
  default = 80
}
variable "timeout_seconds" {
  type    = number
  default = 60
}
variable "deletion_protection" {
  type    = bool
  default = false
}

resource "google_cloud_run_v2_service" "this" {
  project             = var.project_id
  name                = var.name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = var.deletion_protection

  template {
    service_account                  = var.service_account_email
    timeout                          = "${var.timeout_seconds}s"
    max_instance_request_concurrency = var.concurrency

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image
      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }
      dynamic "env" {
        for_each = var.env
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = var.secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }
    }
  }

  # Cloud Build deploys new images; Terraform owns the service shape, IAM and wiring.
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      template[0].revision,
      client,
      client_version,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  count    = var.public ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "invoker" {
  for_each = toset(var.invokers)
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${each.value}"
}

output "name" { value = google_cloud_run_v2_service.this.name }
output "url" { value = google_cloud_run_v2_service.this.uri }
