FROM python:3.12-slim

# Dependências de sistema para OpenCV / DeepFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .

# Instalar dependências diretamente no Python do sistema
RUN pip install --no-cache-dir -e ".[dev]" || pip install --no-cache-dir -e .

# Pré-baixar pesos do ArcFace e RetinaFace no build — evita download corrompido em runtime
# detector_backend="skip" garante que só o modelo de embedding é carregado aqui
RUN python - <<'EOF'
import numpy as np
from deepface import DeepFace

dummy = np.zeros((112, 112, 3), dtype=np.uint8)

# Carrega e salva pesos do ArcFace
try:
    DeepFace.represent(img_path=dummy, model_name="ArcFace", detector_backend="skip", enforce_detection=False)
    print("ArcFace: OK")
except Exception as e:
    print(f"ArcFace: {e}")

# Carrega e salva pesos do detector RetinaFace
try:
    DeepFace.extract_faces(img_path=dummy, detector_backend="retinaface", enforce_detection=False)
    print("RetinaFace: OK")
except Exception as e:
    print(f"RetinaFace: {e}")
EOF

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
