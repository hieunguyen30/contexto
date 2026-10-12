variable "project_id" { type = string }
variable "region" { type = string }
variable "bucket_name" { type = string }
variable "object_users" {
  description = "Service account emails granted read/write on objects."
  type        = list(string)
}
variable "force_destroy" {
  type    = bool
  default = false
}

resource "google_storage_bucket" "raw_text" {
  project                     = var.project_id
  name                        = var.bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = var.force_destroy

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
}

resource "google_storage_bucket_iam_member" "object_user" {
  for_each = toset(var.object_users)
  bucket   = google_storage_bucket.raw_text.name
  role     = "roles/storage.objectUser"
  member   = "serviceAccount:${each.value}"
}

output "bucket_name" { value = google_storage_bucket.raw_text.name }
