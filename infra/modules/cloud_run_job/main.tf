variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }
variable "service_account_email" { type = string }
variable "image" { type = string }
variable "command" {
  type = list(string)
}
variable "env" {
  type    = map(string)
  default = {}
}
variable "secret_env" {
  description = "ENV_VAR => secret_id (latest version)."
  type        = map(string)
  default     = {}
}
variable "max_retries" {
  type    = number
  default = 2
}
variable "timeout_seconds" {
  type    = number
  default = 600
}
variable "deletion_protection" {
  type    = bool
  default = false
}

resource "google_cloud_run_v2_job" "this" {
  project             = var.project_id
  name                = var.name
  location            = var.region
  deletion_protection = var.deletion_protection

  template {
    template {
      service_account = var.service_account_email
      max_retries     = var.max_retries
      timeout         = "${var.timeout_seconds}s"

      containers {
        image   = var.image
        command = var.command
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
  }

  # Cloud Build deploys new images.
  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
      client,
      client_version,
    ]
  }
}

output "name" { value = google_cloud_run_v2_job.this.name }
