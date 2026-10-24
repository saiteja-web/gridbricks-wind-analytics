cat > backend/requirements.txt <<'EOF'
fastapi
uvicorn[standard]
httpx
pydantic>=2.0
pandas
pyarrow
pytest
pytest-asyncio
EOF

cat > backend/Dockerfile <<'EOF'
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY tests ./tests

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

cat > backend/app/main.py <<'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Gridbricks Wind Analytics API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/v1/analytics")
async def get_analytics():
    return {
        "message": "Wind analytics API is running",
        "status": "not_implemented",
    }
EOF

cat > backend/app/models.py <<'EOF'
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ForecastRevision(StrictModel):
    timestamp: datetime
    forecast_mw: float = Field(ge=0)


class WindForecast(StrictModel):
    delivery_date: date
    forecast_mw: float = Field(ge=0)
    actual_mw: float | None = Field(default=None, ge=0)


class AnalyticsKPI(StrictModel):
    mae_mw: float = Field(ge=0)
    bias_mw: float
    sample_count: int = Field(ge=0)
EOF

cat > backend/app/services/elexon_client.py <<'EOF'
from pathlib import Path

import httpx

CACHE_DIR = Path(__file__).resolve().parents[2] / "data_cache"


async def fetch_json(url: str, params: dict | None = None):
    """Fetch JSON from an upstream API asynchronously."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()


def load_parquet(filename: str):
    """Load a locally cached Parquet file."""
    import pandas as pd

    path = CACHE_DIR / filename

    if not path.is_file() or path.parent != CACHE_DIR:
        raise FileNotFoundError(f"Cache file not found: {filename}")

    return pd.read_parquet(path)
EOF

cat > backend/app/services/analytics.py <<'EOF'
import pandas as pd


def calculate_error_metrics(
    actual: pd.Series,
    forecast: pd.Series,
) -> dict:
    """Calculate error metrics using aligned, non-null observations.

    Error is forecast minus actual:
    positive bias means over-forecasting.
    """
    aligned = pd.concat(
        [
            actual.rename("actual"),
            forecast.rename("forecast"),
        ],
        axis=1,
        join="inner",
    ).dropna()

    if aligned.empty:
        return {
            "mae_mw": 0.0,
            "bias_mw": 0.0,
            "sample_count": 0,
        }

    errors = aligned["forecast"] - aligned["actual"]

    return {
        "mae_mw": float(errors.abs().mean()),
        "bias_mw": float(errors.mean()),
        "sample_count": int(len(errors)),
    }


def align_day_ahead(
    forecasts: pd.DataFrame,
    decision_time,
) -> pd.DataFrame:
    """Keep only forecasts published by the decision time.

    Expected columns: delivery_time, published_at, forecast_mw.
    Select the latest available forecast for each delivery time.
    """
    decision_time = pd.Timestamp(decision_time)

    eligible = forecasts.loc[
        forecasts["published_at"] <= decision_time
    ].copy()

    return (
        eligible.sort_values("published_at")
        .drop_duplicates(subset=["delivery_time"], keep="last")
        .sort_values("delivery_time")
        .reset_index(drop=True)
    )
EOF

cat > backend/tests/test_analytics.py <<'EOF'
import pandas as pd
import pytest

from app.services.analytics import (
    align_day_ahead,
    calculate_error_metrics,
)


def test_error_metrics():
    actual = pd.Series([100.0, 200.0])
    forecast = pd.Series([110.0, 180.0])

    result = calculate_error_metrics(actual, forecast)

    assert result["mae_mw"] == pytest.approx(15.0)
    assert result["bias_mw"] == pytest.approx(-5.0)
    assert result["sample_count"] == 2


def test_empty_error_metrics():
    result = calculate_error_metrics(
        pd.Series([], dtype=float),
        pd.Series([], dtype=float),
    )

    assert result["sample_count"] == 0


def test_day_ahead_excludes_future_revisions():
    forecasts = pd.DataFrame({
        "delivery_time": pd.to_datetime([
            "2026-01-02 12:00",
            "2026-01-02 12:00",
            "2026-01-02 13:00",
        ]),
        "published_at": pd.to_datetime([
            "2026-01-01 10:00",
            "2026-01-01 12:00",
            "2026-01-01 15:00",
        ]),
        "forecast_mw": [100.0, 120.0, 150.0],
    })

    result = align_day_ahead(
        forecasts,
        decision_time="2026-01-01 11:00",
    )

    assert len(result) == 1
    assert result.iloc[0]["forecast_mw"] == 100.0
EOF