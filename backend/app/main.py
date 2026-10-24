from pathlib import Path
from typing import Literal
from app.models import AccuracyEvaluationResponse, DayAheadDeskResponse
from app.services.analytics import WindAnalyticsService
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Gridbricks UK Day-Ahead Wind Procurement & Forecast Evaluation API",
    version="1.0.0",
    description=(
        "Point-in-time Elexon BMRS wind generation forecast vs outturn"
        " evaluation for January 2026 day-ahead market decisions."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analytics_service = WindAnalyticsService(data_dir=Path("./data_cache"))


@app.get("/api/v1/health")
async def health_check():
  return {
      "status": "healthy",
      "actual_records_cached": len(analytics_service.actuals_df),
      "forecast_records_cached": len(analytics_service.forecasts_df),
  }


@app.get("/api/v1/day-ahead-desk", response_model=DayAheadDeskResponse)
async def get_day_ahead_desk(
    decision_date: str = Query(
        "2026-01-14",
        pattern=r"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$",
        description=(
            "Date the purchase decision is made (YYYY-MM-DD). Defaults to"
            " Jan 2026 cached dataset."
        ),
    ),
    decision_cutoff_hour_utc: int = Query(11, ge=0, le=23),
):
  try:
    return analytics_service.get_day_ahead_desk(
        decision_date=decision_date,
        decision_cutoff_hour_utc=decision_cutoff_hour_utc,
    )
  except Exception as e:
    raise HTTPException(status_code=400, detail=str(e))


@app.get(
    "/api/v1/accuracy-evaluation", response_model=AccuracyEvaluationResponse
)
async def get_accuracy_evaluation(
    decision_cutoff_hour_utc: int = Query(11, ge=0, le=23),
    resolution_mode: Literal[
        "half_hourly_interpolated", "hourly_exact"
    ] = Query("half_hourly_interpolated"),
    start_date: str = Query("2026-01-02"),
    end_date: str = Query("2026-02-01"),
):
  try:
    return analytics_service.get_accuracy_evaluation(
        decision_cutoff_hour_utc=decision_cutoff_hour_utc,
        resolution_mode=resolution_mode,
        start_date=start_date,
        end_date=end_date,
    )
  except Exception as e:
    raise HTTPException(status_code=400, detail=str(e))