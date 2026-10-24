# Gridbricks UK Day-Ahead Wind Analytics

A full-stack wind generation forecasting and procurement analytics dashboard built to support day-ahead electricity market decisions in Great Britain.

**Live Demo:** [Open Dashboard](https://gridbricks-wind-analytics.vercel.app)  
**API Documentation:** [Explore Swagger UI](https://gridbricks-wind-api.onrender.com/docs)  
**Backend Health:** [Check API Status](https://gridbricks-wind-api.onrender.com/api/v1/health)  
**Repository:** [GitHub](https://github.com/saiteja-web/gridbricks-wind-analytics)

---

## 1. Overview

Wind generation is variable, and forecast errors can create operational and procurement challenges for electricity market participants. A day-ahead forecast is useful only when its timing, uncertainty, and historical accuracy are understood.

Gridbricks UK Day-Ahead Wind Analytics is a decision-support application that compares wind generation forecasts with actual generation, evaluates historical forecast errors, and presents analytical signals relevant to day-ahead procurement planning.

The application uses January 2026 data from the Elexon Balancing Mechanism Reporting Service (BMRS). It combines a FastAPI backend for data processing and analytics with a React dashboard for interactive visualization.

### Objectives

- Compare day-ahead wind generation forecasts with observed generation.
- Evaluate forecast accuracy using standard error metrics.
- Apply bias correction using information available from completed historical delivery days.
- Visualize forecast uncertainty and potential wind shortfall.
- Present decision-support metrics through an interactive dashboard.
- Expose analytical results through REST API endpoints.
- Package and deploy the application using Docker, Render, and Vercel.

> **Scope:** This is a historical-data analytics and decision-support prototype. Its procurement and thermal buffer recommendations are analytical estimates, not live market bids or dispatch instructions.

## 2. Live Application

| Component | URL |
|---|---|
| Dashboard | https://gridbricks-wind-analytics.vercel.app |
| API documentation | https://gridbricks-wind-api.onrender.com/docs |
| API health | https://gridbricks-wind-api.onrender.com/api/v1/health |
| Day-ahead desk API | https://gridbricks-wind-api.onrender.com/api/v1/day-ahead-desk |
| Accuracy evaluation API | https://gridbricks-wind-api.onrender.com/api/v1/accuracy-evaluation |

The backend is hosted on Render, and the frontend is hosted on Vercel. The backend's cached data files allow the deployed application to serve the prepared January 2026 dataset without requiring a fresh data download for every request.

**Hosting note:** The free backend instance may spin down after inactivity. The first request after a period of inactivity can therefore take longer than subsequent requests.

## 3. Key Features

### 3.1 Day-Ahead Procurement Desk

The day-ahead view provides an operational perspective on a selected decision date and its corresponding delivery date.

It presents:

- Raw and bias-corrected wind generation forecasts.
- Expected wind generation and actual generation comparisons.
- Half-hourly delivery-period data.
- Forecast uncertainty and lower-confidence estimates.
- Wind generation deficit indicators.
- An estimated thermal generation buffer to support procurement analysis.

These metrics help users understand when forecast uncertainty or a potential wind shortfall may warrant additional scrutiny.

### 3.2 Forecast Accuracy Evaluation

The accuracy analysis evaluates historical forecast performance using aligned forecast and actual generation observations.

Reported metrics include:

- **MAE — Mean Absolute Error:** Average absolute forecast error, measured in MW.
- **RMSE — Root Mean Squared Error:** Error metric that penalizes larger errors more heavily.
- **Mean Bias:** Average signed forecast error, useful for identifying systematic overforecasting or underforecasting.
- **NMAE — Normalized Mean Absolute Error:** Mean absolute error normalized by the relevant actual generation scale.
- **P90 and P95 deficit estimates:** High-percentile shortfall measures used to characterize larger wind deficits.
- **Bias-corrected error metrics:** Accuracy measures calculated after applying the historical bias correction.

Metrics are calculated over the available aligned observations. The precise number of evaluated intervals can differ from the theoretical number of half-hourly periods when observations are missing or cannot be aligned.

### 3.3 Historical Bias Correction

Forecast bias can cause systematic overestimation or underestimation of wind generation.

The application incorporates a historical bias-correction approach that uses completed prior delivery days to estimate the bias available for a subsequent delivery day.

The objective is to avoid look-ahead leakage: a forecast for a given delivery day should not be corrected using actual generation or forecast errors from that same delivery day or from future delivery days.

This distinction is important when evaluating whether a correction method would have been usable in an actual day-ahead decision process.

### 3.4 Interactive Dashboard

The React and TypeScript frontend provides two primary analytical views:

- **Day-Ahead Procurement Desk:** Explore the forecast and procurement indicators for a delivery day.
- **Forecast Accuracy Lab:** Examine historical forecast performance and error metrics.

The dashboard consumes data through the backend API rather than embedding the analytical calculations directly in the browser.

## 4. Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI, Pydantic |
| Data processing | Pandas, NumPy |
| Cached data format | Apache Parquet, PyArrow |
| API testing | Pytest, FastAPI TestClient |
| Frontend validation | TypeScript compiler, Vite production build |
| Containerization | Docker, Docker Compose |
| Backend hosting | Render |
| Frontend hosting | Vercel |
| Data source | Elexon BMRS |

## 5. Architecture and Data Flow

The application separates data access, analytical processing, API responses, and presentation.

```text
                Elexon BMRS
                     |
                     v
          Prepared January 2026 data
             (Parquet cache files)
                     |
                     v
          FastAPI backend service
             /             \
            v               v
    Day-ahead analytics   Accuracy evaluation
            \               /
             v             v
               JSON API
                  |
                  v
          React + TypeScript
             dashboard
                  |
                  v
        KPIs, charts and tables
```

### Backend responsibilities

- Load and access the cached actual generation and forecast datasets.
- Align forecast and actual observations for evaluation.
- Apply the historical bias-correction logic.
- Calculate forecast accuracy and deficit metrics.
- Build the day-ahead response and return structured API data.

### Frontend responsibilities

- Request data from the REST API.
- Display procurement KPIs and forecast information.
- Visualize forecast performance and uncertainty.
- Provide interactive controls for exploring the analytical views.

### Deployment responsibilities

- Docker packages the backend and its required data files.
- Render runs the API service.
- Vercel builds and hosts the static frontend.
- The frontend uses `VITE_API_BASE_URL` to locate the deployed backend.

## 6. Data Sources

The application uses Elexon BMRS datasets for Great Britain's electricity system.

| Dataset | Purpose |
|---|---|
| `FUELHH` | Half-hourly actual generation data, including wind generation |
| `WINDFOR` | Wind generation forecast data |

The application uses prepared Parquet cache files for January 2026:

```text
backend/
└── data_cache/
    ├── fuelhh_wind_jan2026.parquet
    └── windfor_jan2026.parquet
```

The deployed API health check reports:

- **1,536** cached actual-generation records.
- **19,032** cached forecast records.

These are cached record counts, not necessarily the number of aligned observations used in an accuracy calculation.

The datasets are cached to make the historical analysis reproducible and reduce dependence on external API availability during ordinary dashboard requests.

**Data limitations:** Results depend on the coverage, timestamps, forecast issue times, and completeness of the supplied datasets. The analysis is restricted to the prepared historical period and should not be interpreted as a continuously refreshed live forecast unless live ingestion is explicitly configured.

## 7. API Reference

Interactive endpoint documentation is available through the deployed [Swagger UI](https://gridbricks-wind-api.onrender.com/docs).

### `GET /api/v1/health`

Checks the backend's health and reports the number of cached actual and forecast records.

Example response:

```json
{
  "status": "healthy",
  "actual_records_cached": 1536,
  "forecast_records_cached": 19032
}
```

### `GET /api/v1/day-ahead-desk`

Returns the day-ahead desk response, including delivery-period data and procurement-oriented analytical indicators.

Use Swagger UI to inspect the supported query parameters, defaults, and response schema.

### `GET /api/v1/accuracy-evaluation`

Returns historical forecast accuracy metrics, including aggregate errors, bias, and deficit-related statistics.

Use Swagger UI to inspect the supported parameters and the complete response model.

## 8. Local Development

### Prerequisites

- Git
- Python 3.12 or a compatible Python environment
- Node.js and npm
- Docker Desktop and Docker Compose (for containerized execution)

### Clone the repository

```bash
git clone https://github.com/saiteja-web/gridbricks-wind-analytics.git
cd gridbricks-wind-analytics
```

### Run the backend locally

Create and activate a virtual environment from the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install backend dependencies and start FastAPI:

```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is available at:

- API health: `http://localhost:8000/api/v1/health`
- Swagger UI: `http://localhost:8000/docs`

The backend expects its data cache files under `backend/data_cache/`. If those files are unavailable, consult the data-loading implementation and Elexon client configuration before running the application.

### Run the frontend locally

In a separate terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open the local Vite URL printed in the terminal.

For the frontend to use the local backend, configure the Vite environment variable before starting the development server:

```text
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Vite environment variables are read at build or development-server startup. Restart the server after changing them.

### Run with Docker Compose

From the repository root:

```bash
docker compose up --build
```

The local development setup exposes the frontend on port `5173` and the backend on port `8000`, as configured in `docker-compose.yml`.

To stop the services:

```bash
docker compose down
```

### Build the production frontend container

From the repository root:

```bash
docker build \
  -f frontend/Dockerfile.prod \
  --build-arg VITE_API_BASE_URL=http://localhost:8000/api/v1 \
  -t gridbricks-wind-frontend:prod \
  ./frontend
```

The example URL is for local testing only. For a real deployment, supply the publicly accessible backend URL instead.

## 9. Testing and Validation

### Backend tests

Run from the `backend/` directory:

```bash
PYTHONPATH=. pytest -v
```

The current test suite contains four tests covering:

1. API health endpoint behavior.
2. Day-ahead forecast validity and prevention of look-ahead bias.
3. Accuracy evaluation metric structure and validity.
4. Historical bias correction using only completed prior delivery days.

The latest recorded run completed with **4 passed, 0 failed**.

### Frontend production build

Run from `frontend/`:

```bash
npm run build
```

The build runs TypeScript compilation and creates the production Vite assets.

The latest recorded build completed successfully. Vite also reported a JavaScript bundle-size warning, which is a performance optimization opportunity rather than a build failure.

### Deployment validation

The backend was deployed to Render and its health endpoint returned a healthy status with the expected cached record counts. The frontend was deployed to Vercel and the live dashboard was manually verified to load and display data.

## 10. Repository Structure

```text
gridbricks-wind-analytics/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   └── services/
│   │       ├── analytics.py
│   │       └── elexon_client.py
│   ├── data_cache/
│   │   ├── fuelhh_wind_jan2026.parquet
│   │   └── windfor_jan2026.parquet
│   ├── tests/
│   │   └── test_analytics.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts
│   │   └── components/
│   │       ├── AccuracyLab.tsx
│   │       ├── DayAheadDesk.tsx
│   │       └── KPICard.tsx
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   └── package.json
├── docker-compose.yml
├── folderCreation.sh
└── .gitignore
```

## 11. Assumptions and Limitations

- The analytical scope is based on cached January 2026 data.
- Forecasts and actuals must be aligned by the appropriate delivery intervals and forecast issue-time rules for a valid evaluation.
- Historical bias correction is intended to use only information available before the target delivery day.
- Accuracy metrics reflect the observations successfully aligned in the evaluation dataset.
- The estimated thermal buffer is a decision-support calculation, not a full unit-commitment or economic-dispatch optimization.
- The application does not place market bids or dispatch generation assets.
- Forecast quality and procurement outcomes depend on source-data quality, assumptions, uncertainty estimates, and the availability of flexible generation.
- The free backend hosting tier may introduce cold-start latency.

## 12. Future Improvements

Potential next steps include:

- Add automated ingestion and scheduled refreshes of Elexon data.
- Improve forecast issue-time selection and missing-interval diagnostics.
- Add more comprehensive backtesting across multiple historical periods.
- Evaluate calibration and uncertainty coverage using out-of-sample data.
- Add frontend code splitting to reduce the production JavaScript bundle.
- Expand API integration tests and add end-to-end frontend tests.
- Add monitoring for data freshness, endpoint latency, and failures.
- Make procurement assumptions and model limitations more visible in the dashboard.

## 13. License and Attribution

This repository is a technical project built using public electricity-market data and open-source software dependencies.

Add a `LICENSE` file before representing the repository as licensed for reuse. Follow Elexon's applicable data-use terms and attribution requirements when redistributing data or derived outputs.

---

**Built as a full-stack energy analytics project exploring day-ahead wind forecasting, forecast evaluation, and procurement decision support.**
