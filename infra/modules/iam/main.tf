# One service account per workload. Project-level roles are kept to a minimum here;
# resource-level grants (secrets, bucket, topic, invoker) live in the modules that own the resource.
variable "project_id" { type = string }

variable "service_accounts" {
  description = "Map of account_id => display name and project-level roles."
  type = map(object({
    display_name  = string
    project_roles = list(string)
  }))
}

resource "google_service_account" "this" {
  for_each     = var.service_accounts
  project      = var.project_id
  account_id   = each.key
  display_name = each.value.display_name
}

locals {
  bindings = flatten([
    for sa, cfg in var.service_accounts : [
      for role in cfg.project_roles : { sa = sa, role = role }
    ]
  ])
}

resource "google_project_iam_member" "roles" {
  for_each = { for b in local.bindings : "${b.sa}:${b.role}" => b }
  project  = var.project_id
  role     = each.value.role
  member   = "serviceAccount:${google_service_account.this[each.value.sa].email}"
}

output "emails" {
  value = { for k, v in google_service_account.this : k => v.email }
}
