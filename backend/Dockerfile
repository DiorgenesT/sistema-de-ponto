FROM python:3.12-slim

# Dependências de sistema para OpenCV / DeepFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/lists/*

WORKDIR /app

# Instalar uv
RUN pip install --no-cache-dir uv

COPY pyproject.toml .
COPY uv.lock .

# Instalar dependências no sistema (sem virtualenv)
RUN uv sync --no-dev --system

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
