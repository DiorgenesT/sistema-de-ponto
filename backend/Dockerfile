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

# Pré-baixar pesos do ArcFace e RetinaFace usando o mecanismo interno do DeepFace.
# SEM try/except — exceção em Python termina com exit code != 0, abortando o build.
# h5py valida integridade de todos os .h5 após cada download.
RUN python - <<'EOF'
import numpy as np
from deepface import DeepFace
dummy = np.zeros((112, 112, 3), dtype=np.uint8)
DeepFace.represent(img_path=dummy, model_name="ArcFace", detector_backend="skip", enforce_detection=False)
print("ArcFace: download OK")
EOF

RUN python - <<'EOF'
import glob, h5py, os
files = glob.glob("/root/.deepface/weights/*.h5")
assert files, "Nenhum arquivo .h5 encontrado — download do ArcFace falhou"
for f in files:
    h5py.File(f, "r").close()
    print(f"h5py OK: {os.path.basename(f)}")
EOF

RUN python - <<'EOF'
import numpy as np
from deepface import DeepFace
dummy = np.zeros((112, 112, 3), dtype=np.uint8)
DeepFace.extract_faces(img_path=dummy, detector_backend="retinaface", enforce_detection=False)
print("RetinaFace: download OK")
EOF

RUN python - <<'EOF'
import glob, h5py, os
for f in glob.glob("/root/.deepface/weights/*.h5"):
    h5py.File(f, "r").close()
    print(f"h5py OK: {os.path.basename(f)}")
EOF

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
