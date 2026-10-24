from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal
from app.models import (
    AccuracyEvaluationResponse,
    DayAheadDeliverySlot,
    DayAheadDeskResponse,
    EvaluationKPIs,
    HalfHourlySlot,
    HorizonAccuracyBucket,
    HourlyProfileError,
)
import numpy as np
import pandas as pd

class WindAnalyticsService:

  def __init__(self, data_dir: Path = Path("./data_cache")):
    self.data_dir = data_dir
    self.actuals_df: pd.DataFrame = pd.DataFrame()
    self.forecasts_df: pd.DataFrame = pd.DataFrame()
    self._load_cache()

  def _load_cache(self) -> None:
    actuals_path = self.data_dir / "fuelhh_wind_jan2026.parquet"
    forecasts_path = self.data_dir / "windfor_jan2026.parquet"
    if not actuals_path.exists() or not forecasts_path.exists():
      raise FileNotFoundError(
          f"Parquet cache not found in {self.data_dir}. Run"
          " wind_forecast_eval.py first."
      )
    self.actuals_df = pd.read_parquet(actuals_path)
    self.forecasts_df = pd.read_parquet(forecasts_path)
    self.actuals_df["startTime"] = pd.to_datetime(
        self.actuals_df["startTime"], utc=True
    )
    self.forecasts_df["startTime"] = pd.to_datetime(
        self.forecasts_df["startTime"], utc=True
    )
    self.forecasts_df["publishTime"] = pd.to_datetime(
        self.forecasts_df["publishTime"], utc=True
    )

  def _build_aligned_df(
      self,
      decision_cutoff_hour_utc: int = 11,
      resolution_mode: Literal[
          "half_hourly_interpolated", "hourly_exact"
      ] = "half_hourly_interpolated",
      start_date: str = "2026-01-02",
      end_date: str = "2026-02-01",
  ) -> pd.DataFrame:
    """Build a point-in-time forecast/actual table.

    For each delivery interval, select the latest forecast published before
    that delivery day's decision deadline. Bias correction for delivery day D
    uses only errors from delivery days strictly before D-1: at the D-1
    decision time, actuals for D-1 may not yet be complete.

    Calibration is calculated before applying the requested display/evaluation
    date filter so callers can evaluate a later date using earlier cached days.
    """
    f_df = self.forecasts_df.copy()
    f_df["delivery_date"] = f_df["startTime"].dt.floor("D")
    f_df["decision_deadline"] = (
        f_df["delivery_date"]
        - pd.Timedelta(days=1)
        + pd.Timedelta(hours=decision_cutoff_hour_utc)
    )

    # A forecast revision is usable only if it was published by the deadline.
    valid_f = f_df[f_df["publishTime"] <= f_df["decision_deadline"]].copy()
    # drop_duplicates selects one complete row; groupby.last() can combine
    # non-null values from different revisions if a row contains nulls.
    latest_at_decision = (
        valid_f.sort_values(["publishTime"])
        .drop_duplicates(subset=["startTime"], keep="last")
    )

    merged = pd.merge(
        self.actuals_df,
        latest_at_decision[
            ["startTime", "publishTime", "forecast_mw", "horizon_hours"]
        ],
        on="startTime",
        how="left",
    ).sort_values("startTime").reset_index(drop=True)

    if resolution_mode == "half_hourly_interpolated":
      # Fill only isolated gaps between known forecast slots. Do not extrapolate
      # into the beginning/end of the series.
      merged["forecast_mw"] = merged["forecast_mw"].interpolate(
          method="linear", limit=1, limit_area="inside"
      )
      merged["publishTime"] = merged["publishTime"].ffill(limit=1)
      merged["horizon_hours"] = merged["horizon_hours"].interpolate(
          method="linear", limit=1, limit_area="inside"
      )
    elif resolution_mode == "hourly_exact":
      merged = merged.dropna(subset=["forecast_mw"]).copy()
    else:
      raise ValueError(f"Unsupported resolution_mode: {resolution_mode}")

    merged = merged.dropna(subset=["forecast_mw", "actual_mw"]).copy()
    merged["delivery_date"] = merged["startTime"].dt.floor("D")

    # Raw forecast errors are retrospective evaluation labels. They must not
    # be used to calibrate that same delivery day or a future decision.
    merged["error_mw"] = merged["forecast_mw"] - merged["actual_mw"]
    merged["abs_error_mw"] = merged["error_mw"].abs()
    merged["deficit_mw"] = merged["error_mw"].clip(lower=0)

    # Expanding-window, point-in-time calibration. For delivery day D, the
    # purchase decision is on D-1, so use only completed delivery days < D-1.
    merged["bias_used_mw"] = 0.0
    for delivery_date, row_indices in merged.groupby("delivery_date", sort=True).groups.items():
      decision_date = delivery_date - pd.Timedelta(days=1)
      history = merged[merged["delivery_date"] < decision_date]
      mean_bias = float(history["error_mw"].mean()) if not history.empty else 0.0
      merged.loc[row_indices, "bias_used_mw"] = mean_bias

    merged["bias_corrected_forecast_mw"] = (
        merged["forecast_mw"] - merged["bias_used_mw"]
    ).clip(lower=0)
    merged["bc_error_mw"] = (
        merged["bias_corrected_forecast_mw"] - merged["actual_mw"]
    )
    merged["bc_abs_error_mw"] = merged["bc_error_mw"].abs()
    merged["bc_deficit_mw"] = merged["bc_error_mw"].clip(lower=0)

    # Apply the requested evaluation window only after calibration, so a call
    # for a later month/day can still use earlier cached observations.
    start_ts = pd.Timestamp(f"{start_date}T00:00:00Z")
    end_exclusive = pd.Timestamp(f"{end_date}T00:00:00Z") + pd.Timedelta(days=1)
    merged = merged[
        (merged["startTime"] >= start_ts)
        & (merged["startTime"] < end_exclusive)
    ].copy()
    return merged.reset_index(drop=True)

  def get_accuracy_evaluation(
      self,
      decision_cutoff_hour_utc: int = 11,
      resolution_mode: Literal[
          "half_hourly_interpolated", "hourly_exact"
      ] = "half_hourly_interpolated",
      start_date: str = "2026-01-02",
      end_date: str = "2026-02-01",
  ) -> AccuracyEvaluationResponse:
    df = self._build_aligned_df(
        decision_cutoff_hour_utc, resolution_mode, start_date, end_date
    )

    # 1. Overall KPIs
    kpis = EvaluationKPIs(
        total_slots=len(df),
        avg_actual_mw=round(float(df["actual_mw"].mean()), 1),
        avg_forecast_mw=round(float(df["forecast_mw"].mean()), 1),
        mae_mw=round(float(df["abs_error_mw"].mean()), 1),
        rmse_mw=round(float(np.sqrt((df["error_mw"] ** 2).mean())), 1),
        mean_bias_mw=round(float(df["error_mw"].mean()), 1),
        nmae_pct=round(
            float((df["abs_error_mw"].sum() / df["actual_mw"].sum()) * 100), 2
        ),
        p90_deficit_mw=round(float(np.percentile(df["deficit_mw"], 90)), 1),
        p95_deficit_mw=round(float(np.percentile(df["deficit_mw"], 95)), 1),
        max_deficit_mw=round(float(df["deficit_mw"].max()), 1),
        bias_corrected_mae_mw=round(float(df["bc_abs_error_mw"].mean()), 1),
        bias_corrected_rmse_mw=round(
            float(np.sqrt((df["bc_error_mw"] ** 2).mean())), 1
        ),
        bias_corrected_p95_deficit_mw=round(
            float(np.percentile(df["bc_deficit_mw"], 95)), 1
        ),
    )

    # 2. Diurnal (Hour-of-Day) Error Profile
    df["hour_utc"] = df["startTime"].dt.hour
    hourly_groups = df.groupby("hour_utc", as_index=False).agg(
        avg_actual_mw=("actual_mw", "mean"),
        avg_forecast_mw=("forecast_mw", "mean"),
        mae_mw=("abs_error_mw", "mean"),
        mean_bias_mw=("error_mw", "mean"),
        p95_deficit_mw=("deficit_mw", lambda s: float(np.percentile(s, 95))),
    )
    hourly_profile = [
        HourlyProfileError(
            hour_utc=int(r.hour_utc),
            avg_actual_mw=round(float(r.avg_actual_mw), 1),
            avg_forecast_mw=round(float(r.avg_forecast_mw), 1),
            mae_mw=round(float(r.mae_mw), 1),
            mean_bias_mw=round(float(r.mean_bias_mw), 1),
            p95_deficit_mw=round(float(r.p95_deficit_mw), 1),
        )
        for r in hourly_groups.itertuples()
    ]

    # 3. Forecast Horizon Decay Analysis (across ALL forecast revisions vs Actuals)
    all_rev_merged = pd.merge(
        self.forecasts_df,
        self.actuals_df[["startTime", "actual_mw"]],
        on="startTime",
        how="inner",
    )
    start_ts = pd.Timestamp(f"{start_date}T00:00:00Z")
    end_exclusive = pd.Timestamp(f"{end_date}T00:00:00Z") + pd.Timedelta(days=1)
    all_rev_merged = all_rev_merged[
        (all_rev_merged["startTime"] >= start_ts)
        & (all_rev_merged["startTime"] < end_exclusive)
        & (all_rev_merged["horizon_hours"] >= 0)
        & (all_rev_merged["horizon_hours"] <= 48)
    ].copy()
    all_rev_merged["err"] = (
        all_rev_merged["forecast_mw"] - all_rev_merged["actual_mw"]
    )
    all_rev_merged["abs_err"] = all_rev_merged["err"].abs()

    buckets = [
        (0, 6, "0–6h (Intraday)"),
        (6, 12, "6–12h (Intraday)"),
        (12, 18, "12–18h (Day-Ahead Early)"),
        (18, 24, "18–24h (Day-Ahead Mid)"),
        (24, 36, "24–36h (Day-Ahead Late)"),
        (36, 48, "36–48h (Two-Day Ahead)"),
    ]
    horizon_decay = []
    for h_min, h_max, label in buckets:
      sub = all_rev_merged[
          (all_rev_merged["horizon_hours"] >= h_min)
          & (all_rev_merged["horizon_hours"] < h_max)
      ]
      if not sub.empty:
        horizon_decay.append(
            HorizonAccuracyBucket(
                horizon_bucket=label,
                horizon_min_h=h_min,
                horizon_max_h=h_max,
                mae_mw=round(float(sub["abs_err"].mean()), 1),
                rmse_mw=round(float(np.sqrt((sub["err"] ** 2).mean())), 1),
                mean_bias_mw=round(float(sub["err"].mean()), 1),
                sample_count=len(sub),
            )
        )

    # 4. Full Timeseries
    timeseries = [
        HalfHourlySlot(
            startTime=r.startTime,
            settlementDate=str(r.settlementDate),
            settlementPeriod=int(r.settlementPeriod),
            actual_mw=round(float(r.actual_mw), 1),
            forecast_mw=round(float(r.forecast_mw), 1),
            bias_corrected_forecast_mw=round(
                float(r.bias_corrected_forecast_mw), 1
            ),
            publishTime=r.publishTime,
            horizon_hours=round(float(r.horizon_hours), 1),
            error_mw=round(float(r.error_mw), 1),
            abs_error_mw=round(float(r.abs_error_mw), 1),
            deficit_mw=round(float(r.deficit_mw), 1),
        )
        for r in df.itertuples()
    ]

    return AccuracyEvaluationResponse(
        decision_cutoff_hour_utc=decision_cutoff_hour_utc,
        resolution_mode=resolution_mode,
        start_date=start_date,
        end_date=end_date,
        kpis=kpis,
        hourly_profile=hourly_profile,
        horizon_decay=horizon_decay,
        timeseries=timeseries,
    )

  def get_day_ahead_desk(
      self,
      decision_date: str = "2026-01-14",
      decision_cutoff_hour_utc: int = 11,
  ) -> DayAheadDeskResponse:
    """Simulate a buyer making a decision for the next delivery day.

    The selected forecast is available by the decision cutoff. Calibration and
    uncertainty statistics use only completed delivery days strictly before
    the decision date. Actual generation is included for retrospective review,
    not as information available to the buyer at decision time.
    """
    dec_dt = datetime.strptime(decision_date, "%Y-%m-%d").replace(
        tzinfo=timezone.utc
    )
    delivery_date = dec_dt + timedelta(days=1)
    delivery_date_str = delivery_date.strftime("%Y-%m-%d")
    cutoff_ts = dec_dt + timedelta(hours=decision_cutoff_hour_utc)

    # Load all cached dates so the selected day can be calibrated from history.
    cache_start = str(self.actuals_df["startTime"].min().date())
    cache_end = str(self.actuals_df["startTime"].max().date())
    aligned = self._build_aligned_df(
        decision_cutoff_hour_utc=decision_cutoff_hour_utc,
        start_date=cache_start,
        end_date=cache_end,
    )

    # At decision time on D-1, only delivery days before D-1 are complete.
    decision_day = pd.Timestamp(decision_date, tz="UTC")
    history = aligned[aligned["delivery_date"] < decision_day].copy()
    if history.empty:
      p90_deficit = 0.0
      p90_error = 0.0
      p10_error = 0.0
    else:
      p90_deficit = float(np.percentile(history["deficit_mw"], 90))
      p90_error = float(np.percentile(history["error_mw"], 90))
      p10_error = float(np.percentile(history["error_mw"], 10))

    day_df = aligned[
        aligned["delivery_date"] == pd.Timestamp(delivery_date_str, tz="UTC")
    ].copy()

    slots = []
    for r in day_df.itertuples():
      f_mw = float(r.forecast_mw)
      slots.append(
          DayAheadDeliverySlot(
              startTime=r.startTime,
              settlementPeriod=int(r.settlementPeriod),
              decision_forecast_mw=round(f_mw, 1),
              bias_corrected_forecast_mw=round(
                  float(r.bias_corrected_forecast_mw), 1
              ),
              # If forecast error E = forecast - actual, then actual = forecast - E.
              p10_band_mw=round(max(0.0, f_mw - p90_error), 1),
              p90_band_mw=round(max(0.0, f_mw - p10_error), 1),
              actual_mw=round(float(r.actual_mw), 1),
              error_mw=round(float(r.error_mw), 1),
              publishTime=r.publishTime,
              horizon_hours=round(float(r.horizon_hours), 1),
          )
      )

    summary = {
        "expected_wind_mean_mw": (
            round(float(day_df["forecast_mw"].mean()), 1)
            if not day_df.empty
            else 0
        ),
        "bias_corrected_mean_mw": (
            round(float(day_df["bias_corrected_forecast_mw"].mean()), 1)
            if not day_df.empty
            else 0
        ),
        "actual_wind_mean_mw": (
            round(float(day_df["actual_mw"].mean()), 1)
            if not day_df.empty
            else 0
        ),
        "day_mae_mw": (
            round(float(day_df["abs_error_mw"].mean()), 1)
            if not day_df.empty
            else 0
        ),
        "day_max_deficit_mw": (
            round(float(day_df["deficit_mw"].max()), 1)
            if not day_df.empty
            else 0
        ),
        "recommended_thermal_buffer_mw": round(p90_deficit, 1),
    }

    return DayAheadDeskResponse(
        decision_date=decision_date,
        delivery_date=delivery_date_str,
        decision_cutoff_timestamp=cutoff_ts,
        summary=summary,
        slots=slots,
    )
