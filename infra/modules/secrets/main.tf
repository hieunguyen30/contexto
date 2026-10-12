# Creates secret containers only. Values are added out of band (gcloud secrets versions add)
# so they never enter Terraform state.
variable "project_id" { type = string }

variable "secrets" {
  description = "Map of secret_id => service account emails allowed to read it."
  type        = map(list(string))
}

resource "google_secret_manager_secret" "this" {
  for_each  = var.secrets
  project   = var.project_id
  secret_id = each.key
  replication {
    auto {}
  }
}

locals {
  accessors = flatten([
    for secret, members in var.secrets : [for m in members : { secret = secret, member = m }]
  ])
}

resource "google_secret_manager_secret_iam_member" "accessor" {
  for_each  = { for a in local.accessors : "${a.secret}:${a.member}" => a }
  project   = var.project_id
  secret_id = google_secret_manager_secret.this[each.value.secret].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${each.value.member}"
}

output "secret_ids" {
  value = { for k, v in google_secret_manager_secret.this : k => v.secret_id }
}
