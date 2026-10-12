# Cloud Monitoring: log-based metrics, ingestion SLO, alert policies, and the operations dashboard.
#
# SLO: 95% of ingestions complete within 30s (measured enqueue -> status=ready, i.e. including queue wait),
# over a rolling 28 days. The worker emits `ingest_complete` with `e2e_ms`; the distribution metric below
# is what the SLO and the dashboard read.
variable "project_id" { type = string }
variable "backend_service" { type = string }
variable "worker_service" { type = string }
variable "ingest_subscription" { type = string }
variable "dlq_subscription" { type = string }
variable "alert_email" {
  description = "Where alerts are sent. Empty = policies are created without a notification channel."
  type        = string
  default     = ""
}
variable "slo_threshold_ms" {
  type    = number
  default = 30000
}
variable "slo_goal" {
  type    = number
  default = 0.95
}

locals {
  channels = [for c in google_monitoring_notification_channel.email : c.id]
}

resource "google_monitoring_notification_channel" "email" {
  count        = var.alert_email == "" ? 0 : 1
  project      = var.project_id
  display_name = "Contexto alerts"
  type         = "email"
  labels       = { email_address = var.alert_email }
}

# ---- Log-based metrics --------------------------------------------------------------------------

resource "google_logging_metric" "ingest_e2e_ms" {
  project     = var.project_id
  name        = "ingest_e2e_ms"
  description = "Time from enqueue to status=ready for each ingestion"
  filter      = "resource.type=\"cloud_run_revision\" AND jsonPayload.message=\"ingest_complete\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "ms"
  }
  value_extractor = "EXTRACT(jsonPayload.e2e_ms)"
  bucket_options {
    explicit_buckets {
      bounds = [1000, 2000, 5000, 10000, 15000, 20000, 25000, 30000, 45000, 60000, 120000, 300000]
    }
  }
}

resource "google_logging_metric" "ingest_failed" {
  project     = var.project_id
  name        = "ingest_failed"
  description = "Ingestion attempts that failed (including retried ones)"
  filter      = "resource.type=\"cloud_run_revision\" AND jsonPayload.message=\"ingest_failed\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

# ---- SLO ------------------------------------------------------------------------------------------

resource "google_monitoring_custom_service" "ingestion" {
  project      = var.project_id
  service_id   = "contexto-ingestion"
  display_name = "Contexto ingestion pipeline"
}

resource "google_monitoring_slo" "ingest_latency" {
  project             = var.project_id
  service             = google_monitoring_custom_service.ingestion.service_id
  slo_id              = "ingest-within-30s"
  display_name        = "95% of ingestions complete within 30s"
  goal                = var.slo_goal
  rolling_period_days = 28

  request_based_sli {
    distribution_cut {
      distribution_filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.ingest_e2e_ms.name}\" resource.type=\"cloud_run_revision\""
      range {
        max = var.slo_threshold_ms
      }
    }
  }
}

# ---- Alerts ---------------------------------------------------------------------------------------

# Fast burn: at 10x the sustainable rate the 28-day error budget is gone in ~2.8 days.
resource "google_monitoring_alert_policy" "slo_burn" {
  project               = var.project_id
  display_name          = "Ingestion SLO: fast error-budget burn"
  combiner              = "OR"
  notification_channels = local.channels

  conditions {
    display_name = "Burn rate > 10 over 1h"
    condition_threshold {
      filter          = "select_slo_burn_rate(\"${google_monitoring_slo.ingest_latency.name}\", \"3600s\")"
      comparison      = "COMPARISON_GT"
      threshold_value = 10
      duration        = "0s"
    }
  }
  documentation {
    content   = "More than 5% of ingestions are taking over 30s (or failing). Check worker logs, OpenAI latency, and the ingest-requests backlog."
    mime_type = "text/markdown"
  }
}

resource "google_monitoring_alert_policy" "dlq_not_empty" {
  project               = var.project_id
  display_name          = "Ingestion dead-letter queue is not empty"
  combiner              = "OR"
  notification_channels = local.channels

  conditions {
    display_name = "Messages in ingest-dlq-pull > 0 for 5m"
    condition_threshold {
      filter          = "metric.type=\"pubsub.googleapis.com/subscription/num_undelivered_messages\" resource.type=\"pubsub_subscription\" resource.label.subscription_id=\"${var.dlq_subscription}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }
    }
  }
  documentation {
    content   = "Ingestions exhausted their retries. Inspect with `gcloud pubsub subscriptions pull ingest-dlq-pull --auto-ack=false`; fix the cause and republish."
    mime_type = "text/markdown"
  }
}

resource "google_monitoring_alert_policy" "backlog_age" {
  project               = var.project_id
  display_name          = "Ingestion backlog is stuck"
  combiner              = "OR"
  notification_channels = local.channels

  conditions {
    display_name = "Oldest unacked ingest message > 5 min"
    condition_threshold {
      filter          = "metric.type=\"pubsub.googleapis.com/subscription/oldest_unacked_message_age\" resource.type=\"pubsub_subscription\" resource.label.subscription_id=\"${var.ingest_subscription}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 300
      duration        = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }
    }
  }
}

resource "google_monitoring_alert_policy" "api_5xx" {
  project               = var.project_id
  display_name          = "API 5xx error rate"
  combiner              = "OR"
  notification_channels = local.channels

  conditions {
    display_name = "5xx responses > 5/min for 5m"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.service_name=\"${var.backend_service}\" metric.label.response_code_class=\"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }
}

# ---- Dashboard ------------------------------------------------------------------------------------

locals {
  tile_h = 4
  tile_w = 6

  # Each widget: [title, filter, aligner, reducer, unit-ish]
  api_filter = "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" resource.label.service_name=\"${var.backend_service}\""
}

resource "google_monitoring_dashboard" "ops" {
  project = var.project_id
  dashboard_json = jsonencode({
    displayName = "Contexto operations"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          xPos = 0, yPos = 0, width = local.tile_w, height = local.tile_h
          widget = {
            title = "API request latency (p50 / p95 / p99)"
            xyChart = {
              yAxis = { label = "ms" }
              dataSets = [for p in ["ALIGN_PERCENTILE_50", "ALIGN_PERCENTILE_95", "ALIGN_PERCENTILE_99"] : {
                plotType = "LINE"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = local.api_filter
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = p, crossSeriesReducer = "REDUCE_MEAN" }
                } }
              }]
            }
          }
        },
        {
          xPos = 6, yPos = 0, width = local.tile_w, height = local.tile_h
          widget = {
            title = "API error rate (requests/s by status class)"
            xyChart = {
              dataSets = [{
                plotType = "STACKED_BAR"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.service_name=\"${var.backend_service}\""
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM", groupByFields = ["metric.label.response_code_class"] }
                } }
              }]
            }
          }
        },
        {
          xPos = 0, yPos = 4, width = local.tile_w, height = local.tile_h
          widget = {
            title = "Ingest queue depth (undelivered messages)"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"pubsub.googleapis.com/subscription/num_undelivered_messages\" resource.type=\"pubsub_subscription\" resource.label.subscription_id=\"${var.ingest_subscription}\""
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_MAX" }
                } }
              }]
            }
          }
        },
        {
          xPos = 6, yPos = 4, width = local.tile_w, height = local.tile_h
          widget = {
            title = "Dead-letter queue count"
            scorecard = {
              timeSeriesQuery = { timeSeriesFilter = {
                filter      = "metric.type=\"pubsub.googleapis.com/subscription/num_undelivered_messages\" resource.type=\"pubsub_subscription\" resource.label.subscription_id=\"${var.dlq_subscription}\""
                aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_MAX" }
              } }
              thresholds = [{ value = 0.5, color = "RED", direction = "ABOVE" }]
            }
          }
        },
        {
          xPos = 0, yPos = 8, width = local.tile_w, height = local.tile_h
          widget = {
            title = "Ingestion time enqueue→ready (p50 / p95) — SLO: 95% < 30s"
            xyChart = {
              yAxis = { label = "ms" }
              dataSets = [for p in ["ALIGN_PERCENTILE_50", "ALIGN_PERCENTILE_95"] : {
                plotType = "LINE"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.ingest_e2e_ms.name}\" resource.type=\"cloud_run_revision\""
                  aggregation = { alignmentPeriod = "300s", perSeriesAligner = p, crossSeriesReducer = "REDUCE_MEAN" }
                } }
              }]
            }
          }
        },
        {
          xPos = 6, yPos = 8, width = local.tile_w, height = local.tile_h
          widget = {
            title = "Failed ingestion attempts"
            xyChart = {
              dataSets = [{
                plotType = "STACKED_BAR"
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.ingest_failed.name}\" resource.type=\"cloud_run_revision\""
                  aggregation = { alignmentPeriod = "300s", perSeriesAligner = "ALIGN_SUM", crossSeriesReducer = "REDUCE_SUM" }
                } }
              }]
            }
          }
        },
      ]
    }
  })
}

output "slo_name" { value = google_monitoring_slo.ingest_latency.name }
output "dashboard_id" { value = google_monitoring_dashboard.ops.id }
