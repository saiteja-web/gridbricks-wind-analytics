from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class HalfHourlySlot(BaseModel):
  startTime: datetime
  settlementDate: str
  settlementPeriod: int
  actual_mw: float
  forecast_mw: float
  bias_corrected_forecast_mw: float
  publishTime: datetime
  horizon_hours: float
  error_mw: float = Field(
      description=(
          "Forecast - Actual (Positive = Wind Deficit / Under-generation)"
      )
  )
  abs_error_mw: float
  deficit_mw: float = Field(
      description=(
          "Unplanned thermal power needed when Forecast > Actual, else 0"
      )
  )


class ForecastRevisionPoint(BaseModel):
  publishTime: datetime
  forecast_mw: float
  horizon_hours: float


class EvaluationKPIs(BaseModel):
  total_slots: int
  avg_actual_mw: float
  avg_forecast_mw: float
  mae_mw: float
  rmse_mw: float
  mean_bias_mw: float
  nmae_pct: float
  p90_deficit_mw: float
  p95_deficit_mw: float
  max_deficit_mw: float
  # Metrics if the trader applies systematic bias correction
  bias_corrected_mae_mw: float
  bias_corrected_rmse_mw: float
  bias_corrected_p95_deficit_mw: float


class HorizonAccuracyBucket(BaseModel):
  horizon_bucket: str
  horizon_min_h: int
  horizon_max_h: int
  mae_mw: float
  rmse_mw: float
  mean_bias_mw: float
  sample_count: int


class HourlyProfileError(BaseModel):
  hour_utc: int
  avg_actual_mw: float
  avg_forecast_mw: float
  mae_mw: float
  mean_bias_mw: float
  p95_deficit_mw: float


class AccuracyEvaluationResponse(BaseModel):
  decision_cutoff_hour_utc: int
  resolution_mode: Literal["half_hourly_interpolated", "hourly_exact"]
  start_date: str
  end_date: str
  kpis: EvaluationKPIs
  hourly_profile: List[HourlyProfileError]
  horizon_decay: List[HorizonAccuracyBucket]
  timeseries: List[HalfHourlySlot]


class DayAheadDeliverySlot(BaseModel):
  startTime: datetime
  settlementPeriod: int
  decision_forecast_mw: float
  bias_corrected_forecast_mw: float
  p10_band_mw: float = Field(
      description="Conservative lower bound (Forecast - P90 historical deficit)"
  )
  p90_band_mw: float = Field(
      description="Upper bound (Forecast - P10 historical error)"
  )
  actual_mw: Optional[float]
  error_mw: Optional[float]
  publishTime: datetime
  horizon_hours: float


class DayAheadDeskResponse(BaseModel):
  decision_date: str
  delivery_date: str
  decision_cutoff_timestamp: datetime
  summary: dict
  slots: List[DayAheadDeliverySlot]