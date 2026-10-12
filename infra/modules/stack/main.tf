# Everything one environment needs. envs/dev and envs/prod are thin wrappers around this module
# and differ only in their tfvars (project, sizing, retention).
terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "us-central1"
}
variable "prefix" {
  description = "Name prefix; must match the _PREFIX/service names used by cloudbuild.yaml."
  type        = string
  default     = "contexto"
}
variable "placeholder_image" {
  description = "Image used on first apply; Cloud Build replaces it."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}
variable "backend_max_instances" {
  type    = number
  default = 5
}
variable "worker_max_instances" {
  type    = number
  default = 5
}
variable "backend_min_instances" {
  type    = number
  default = 0
}
variable "force_destroy_bucket" {
  type    = bool
  default = false
}
variable "deletion_protection" {
  type    = bool
  default = false
}

data "google_project" "this" {
  project_id = var.project_id
}

locals {
  frontend_url = "https://${var.prefix}-frontend-${data.google_project.this.number}.${var.region}.run.app"
  bucket_name  = "${var.project_id}-${var.prefix}-raw-text"
  sa           = module.iam.emails
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "pubsub.googleapis.com",
    "storage.googleapis.com",
    "cloudscheduler.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "bigquery.googleapis.com",
  ])
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "images" {
  project       = var.project_id
  location      = var.region
  repository_id = var.prefix
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]
}

module "iam" {
  source     = "../iam"
  project_id = var.project_id
  service_accounts = {
    "${var.prefix}-backend"  = { display_name = "Contexto API", project_roles = ["roles/logging.logWriter"] }
    "${var.prefix}-worker"   = { display_name = "Contexto ingest worker", project_roles = ["roles/logging.logWriter"] }
    "${var.prefix}-frontend" = { display_name = "Contexto web", project_roles = [] }
    "${var.prefix}-push"     = { display_name = "Pub/Sub push identity", project_roles = [] }
  }
  depends_on = [google_project_service.apis]
}

module "secrets" {
  source     = "../secrets"
  project_id = var.project_id
  secrets = {
    MONGODB_URI       = [local.sa["${var.prefix}-backend"], local.sa["${var.prefix}-worker"]]
    OPENAI_API_KEY    = [local.sa["${var.prefix}-backend"], local.sa["${var.prefix}-worker"]]
    ANTHROPIC_API_KEY = [local.sa["${var.prefix}-backend"]]
  }
  depends_on = [google_project_service.apis]
}

module "storage" {
  source        = "../storage"
  project_id    = var.project_id
  region        = var.region
  bucket_name   = local.bucket_name
  object_users  = [local.sa["${var.prefix}-backend"], local.sa["${var.prefix}-worker"]]
  force_destroy = var.force_destroy_bucket
  depends_on    = [google_project_service.apis]
}

module "backend" {
  source                = "../cloud_run"
  project_id            = var.project_id
  region                = var.region
  name                  = "${var.prefix}-backend"
  service_account_email = local.sa["${var.prefix}-backend"]
  image                 = var.placeholder_image
  public                = true
  min_instances         = var.backend_min_instances
  max_instances         = var.backend_max_instances
  timeout_seconds       = 120
  deletion_protection   = var.deletion_protection
  env = {
    CORS_ORIGIN     = local.frontend_url
    PUBSUB_TOPIC    = "ingest-requests"
    RAW_TEXT_BUCKET = module.storage.bucket_name
  }
  secret_env = module.secrets.secret_ids
  depends_on = [module.secrets]
}

module "worker" {
  source                = "../cloud_run"
  project_id            = var.project_id
  region                = var.region
  name                  = "${var.prefix}-worker"
  service_account_email = local.sa["${var.prefix}-worker"]
  image                 = var.placeholder_image
  public                = false
  invokers              = [local.sa["${var.prefix}-push"]]
  max_instances         = var.worker_max_instances
  concurrency           = 4
  timeout_seconds       = 300
  memory                = "1Gi"
  deletion_protection   = var.deletion_protection
  env = {
    RAW_TEXT_BUCKET = module.storage.bucket_name
  }
  secret_env = {
    MONGODB_URI    = module.secrets.secret_ids["MONGODB_URI"]
    OPENAI_API_KEY = module.secrets.secret_ids["OPENAI_API_KEY"]
  }
}

module "frontend" {
  source                = "../cloud_run"
  project_id            = var.project_id
  region                = var.region
  name                  = "${var.prefix}-frontend"
  service_account_email = local.sa["${var.prefix}-frontend"]
  image                 = var.placeholder_image
  public                = true
  max_instances         = 5
  deletion_protection   = var.deletion_protection
}

module "pubsub" {
  source                     = "../pubsub"
  project_id                 = var.project_id
  push_endpoint              = module.worker.url
  push_service_account_email = local.sa["${var.prefix}-push"]
  publisher_emails           = [local.sa["${var.prefix}-backend"]]
  depends_on                 = [google_project_service.apis]
}

output "backend_url" { value = module.backend.url }
output "frontend_url" { value = module.frontend.url }
output "worker_url" { value = module.worker.url }
output "raw_text_bucket" { value = module.storage.bucket_name }
output "service_accounts" { value = local.sa }
