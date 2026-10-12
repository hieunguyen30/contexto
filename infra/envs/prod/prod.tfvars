project_id            = "contexto-prod" # REPLACE with your prod GCP project id
region                = "us-central1"
backend_min_instances = 1 # no cold starts on the API
backend_max_instances = 20
worker_max_instances  = 10
force_destroy_bucket  = false
deletion_protection   = true
alert_email           = "" # set to receive alert emails
