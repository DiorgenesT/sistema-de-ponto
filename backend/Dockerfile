FROM python:3.12-slim

# Dependências de sistema para OpenCV / DeepFace + curl para download dos pesos
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .

# Instalar dependências diretamente no Python do sistema
RUN pip install --no-cache-dir -e ".[dev]" || pip install --no-cache-dir -e .

# Pré-baixar pesos do ArcFace e RetinaFace no build.
# curl com --fail aborta o build se o download falhar (exit code != 0).
# h5py valida a integridade dos arquivos — build falha se arquivo corrompido.
RUN mkdir -p /root/.deepface/weights

RUN curl -fL --retry 5 --retry-delay 3 --retry-connrefused \
        -o /root/.deepface/weights/arcface_weights.h5 \
        "https://github.com/serengil/deepface_models/releases/download/v1.0/arcface_weights.h5" && \
    python -c "import h5py; h5py.File('/root/.deepface/weights/arcface_weights.h5', 'r').close(); print('ArcFace weights: OK')"

RUN curl -fL --retry 5 --retry-delay 3 --retry-connrefused \
        -o /root/.deepface/weights/retinaface_resnet50.h5 \
        "https://github.com/serengil/deepface_models/releases/download/v1.0/retinaface_resnet50.h5" && \
    python -c "import h5py; h5py.File('/root/.deepface/weights/retinaface_resnet50.h5', 'r').close(); print('RetinaFace weights: OK')"

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
