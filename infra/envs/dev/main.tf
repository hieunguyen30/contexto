terraform {
  required_version = ">= 1.6"
  backend "gcs" {
    # bucket is supplied at init: terraform init -backend-config=backend.hcl
    prefix = "contexto/dev"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "us-central1"
}
variable "backend_min_instances" {
  type    = number
  default = 0
}
variable "backend_max_instances" {
  type    = number
  default = 5
}
variable "worker_max_instances" {
  type    = number
  default = 5
}
variable "force_destroy_bucket" {
  type    = bool
  default = false
}
variable "deletion_protection" {
  type    = bool
  default = false
}

module "stack" {
  source                = "../../modules/stack"
  project_id            = var.project_id
  region                = var.region
  backend_min_instances = var.backend_min_instances
  backend_max_instances = var.backend_max_instances
  worker_max_instances  = var.worker_max_instances
  force_destroy_bucket  = var.force_destroy_bucket
  deletion_protection   = var.deletion_protection
}

output "backend_url" { value = module.stack.backend_url }
output "frontend_url" { value = module.stack.frontend_url }
output "worker_url" { value = module.stack.worker_url }
output "raw_text_bucket" { value = module.stack.raw_text_bucket }
