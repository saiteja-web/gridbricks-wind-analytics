const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export interface DayAheadDeliverySlot {
  startTime: string;
  settlementPeriod: number;
  decision_forecast_mw: number;
  bias_corrected_forecast_mw: number;
  p10_band_mw: number;
  p90_band_mw: number;
  actual_mw: number | null;
  error_mw: number | null;
  publishTime: string;
  horizon_hours: number;
}

export interface DayAheadDeskResponse {
  decision_date: string;
  delivery_date: string;
  decision_cutoff_timestamp: string;
  summary: {
    expected_wind_mean_mw: number;
    bias_corrected_mean_mw: number;
    actual_wind_mean_mw: number;
    day_mae_mw: number;
    day_max_deficit_mw: number;
    recommended_thermal_buffer_mw: number;
  };
  slots: DayAheadDeliverySlot[];
}

export interface EvaluationKPIs {
  total_slots: number;
  avg_actual_mw: number;
  avg_forecast_mw: number;
  mae_mw: number;
  rmse_mw: number;
  mean_bias_mw: number;
  nmae_pct: number;
  p90_deficit_mw: number;
  p95_deficit_mw: number;
  max_deficit_mw: number;
  bias_corrected_mae_mw: number;
  bias_corrected_rmse_mw: number;
  bias_corrected_p95_deficit_mw: number;
}

export interface HourlyProfileError {
  hour_utc: number;
  avg_actual_mw: number;
  avg_forecast_mw: number;
  mae_mw: number;
  mean_bias_mw: number;
  p95_deficit_mw: number;
}

export interface HorizonAccuracyBucket {
  horizon_bucket: string;
  horizon_min_h: number;
  horizon_max_h: number;
  mae_mw: number;
  rmse_mw: number;
  mean_bias_mw: number;
  sample_count: number;
}

export interface HalfHourlySlot {
  startTime: string;
  settlementDate: string;
  settlementPeriod: number;
  actual_mw: number;
  forecast_mw: number;
  bias_corrected_forecast_mw: number;
  publishTime: string;
  horizon_hours: number;
  error_mw: number;
  abs_error_mw: number;
  deficit_mw: number;
}

export interface AccuracyEvaluationResponse {
  decision_cutoff_hour_utc: number;
  resolution_mode: 'half_hourly_interpolated' | 'hourly_exact';
  start_date: string;
  end_date: string;
  kpis: EvaluationKPIs;
  hourly_profile: HourlyProfileError[];
  horizon_decay: HorizonAccuracyBucket[];
  timeseries: HalfHourlySlot[];
}

export async function fetchDayAheadDesk(
  decisionDate: string,
  cutoffHourUtc: number
): Promise<DayAheadDeskResponse> {
  const res = await fetch(
    `${API_BASE_URL}/day-ahead-desk?decision_date=${decisionDate}&decision_cutoff_hour_utc=${cutoffHourUtc}`
  );
  if (!res.ok) throw new Error(`Failed to fetch Day-Ahead Desk: ${res.statusText}`);
  return res.json();
}

export async function fetchAccuracyEvaluation(
  cutoffHourUtc: number,
  resolutionMode: 'half_hourly_interpolated' | 'hourly_exact'
): Promise<AccuracyEvaluationResponse> {
  const res = await fetch(
    `${API_BASE_URL}/accuracy-evaluation?decision_cutoff_hour_utc=${cutoffHourUtc}&resolution_mode=${resolutionMode}`
  );
  if (!res.ok) throw new Error(`Failed to fetch Accuracy Evaluation: ${res.statusText}`);
  return res.json();
} 