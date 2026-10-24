import pandas as pd
from app.main import app
from app.services.analytics import WindAnalyticsService
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health_endpoint():
  response = client.get("/api/v1/health")
  assert response.status_code == 200
  data = response.json()
  assert data["status"] == "healthy"
  assert data["actual_records_cached"] > 0
  assert data["forecast_records_cached"] > 0


def test_zero_look_ahead_bias_in_day_ahead_desk():
  """No selected forecast can be published after the decision cutoff."""
  response = client.get(
      "/api/v1/day-ahead-desk?decision_date=2026-01-14&decision_cutoff_hour_utc=11"
  )
  assert response.status_code == 200
  payload = response.json()

  assert payload["decision_date"] == "2026-01-14"
  assert payload["delivery_date"] == "2026-01-15"
  assert len(payload["slots"]) == 48

  cutoff_ts = payload["decision_cutoff_timestamp"]
  for slot in payload["slots"]:
    assert slot["publishTime"] <= cutoff_ts
    assert slot["horizon_hours"] >= 13.0


def test_accuracy_evaluation_metrics_are_well_formed():
  """Metrics should be valid; correction is not guaranteed to improve every sample."""
  response = client.get(
      "/api/v1/accuracy-evaluation?decision_cutoff_hour_utc=11&resolution_mode=half_hourly_interpolated"
  )
  assert response.status_code == 200
  kpis = response.json()["kpis"]

  assert kpis["total_slots"] > 1400
  assert kpis["mae_mw"] > 0
  assert kpis["rmse_mw"] >= kpis["mae_mw"]
  assert kpis["bias_corrected_mae_mw"] >= 0
  assert kpis["bias_corrected_rmse_mw"] >= 0
  assert kpis["p95_deficit_mw"] >= kpis["p90_deficit_mw"]


def test_bias_correction_uses_only_completed_prior_delivery_days():
  """Jan 4 delivery decision occurs Jan 3, so Jan 3 actuals are not history."""
  service = WindAnalyticsService.__new__(WindAnalyticsService)
  dates = pd.to_datetime(
      ["2026-01-02T00:00:00Z", "2026-01-03T00:00:00Z", "2026-01-04T00:00:00Z"],
      utc=True,
  )
  service.actuals_df = pd.DataFrame({
      "startTime": dates,
      "settlementDate": ["2026-01-02", "2026-01-03", "2026-01-04"],
      "settlementPeriod": [1, 1, 1],
      "actual_mw": [100.0, 100.0, 100.0],
  })

  forecasts = []
  selected_forecasts = [110.0, 200.0, 300.0]
  for delivery_ts, selected in zip(dates, selected_forecasts):
    deadline_day = delivery_ts - pd.Timedelta(days=1)
    forecasts.append({
        "startTime": delivery_ts,
        "publishTime": deadline_day + pd.Timedelta(hours=10),
        "forecast_mw": selected,
        "horizon_hours": 14.0,
    })
    # This later revision must be ignored because it misses the 11:00 cutoff.
    forecasts.append({
        "startTime": delivery_ts,
        "publishTime": deadline_day + pd.Timedelta(hours=12),
        "forecast_mw": 999.0,
        "horizon_hours": 12.0,
    })
  service.forecasts_df = pd.DataFrame(forecasts)
  service.forecasts_df["startTime"] = pd.to_datetime(service.forecasts_df["startTime"], utc=True)
  service.forecasts_df["publishTime"] = pd.to_datetime(service.forecasts_df["publishTime"], utc=True)

  aligned = service._build_aligned_df(
      decision_cutoff_hour_utc=11,
      start_date="2026-01-02",
      end_date="2026-01-04",
  ).set_index("settlementDate")

  # Jan 2 and Jan 3 have no completed prior delivery date available in this fixture.
  assert aligned.loc["2026-01-02", "bias_used_mw"] == 0.0
  assert aligned.loc["2026-01-03", "bias_used_mw"] == 0.0
  # Jan 4 decision is on Jan 3; only Jan 2's +10 MW error is available.
  assert aligned.loc["2026-01-04", "bias_used_mw"] == 10.0
  assert aligned.loc["2026-01-04", "bias_corrected_forecast_mw"] == 290.0
  assert aligned.loc["2026-01-04", "forecast_mw"] == 300.0
