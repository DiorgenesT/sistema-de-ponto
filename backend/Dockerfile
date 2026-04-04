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

# Pré-baixar pesos do ArcFace via curl (segue redirects do GitHub corretamente)
RUN mkdir -p /root/.deepface/weights && \
    curl -fL --retry 5 --retry-delay 10 \
         -o /root/.deepface/weights/arcface_weights.h5 \
         "https://github.com/serengil/deepface_models/releases/download/v1.0/arcface_weights.h5" && \
    python -c "import h5py; h5py.File('/root/.deepface/weights/arcface_weights.h5', 'r').close(); print('ArcFace h5py OK')"

# Pré-baixar pesos do RetinaFace via DeepFace (arquivo .pkl, não .h5)
RUN python - <<'EOF'
import numpy as np
from deepface import DeepFace
dummy = np.zeros((112, 112, 3), dtype=np.uint8)
DeepFace.extract_faces(img_path=dummy, detector_backend="retinaface", enforce_detection=False)
print("RetinaFace: download OK")
EOF

# Validar todos os .h5 presentes
RUN python - <<'EOF'
import glob, h5py, os
for f in glob.glob("/root/.deepface/weights/*.h5"):
    h5py.File(f, "r").close()
    print(f"h5py OK: {os.path.basename(f)}")
EOF

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
