FROM python:3.12-slim

WORKDIR /app

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Install dependencies first for optimal Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code, tests, and pre-warmed January 2026 Parquet cache
COPY app ./app
COPY tests ./tests
COPY data_cache ./data_cache

# Ensure cache exists at build/runtime; if missing, fetch from Elexon BMRS
RUN if [ ! -f ./data_cache/fuelhh_wind_jan2026.parquet ] || [ ! -f ./data_cache/windfor_jan2026.parquet ]; then \
        python app/services/elexon_client.py; \
    fi

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]