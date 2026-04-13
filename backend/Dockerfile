FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Baixa modelos OpenCV para reconhecimento facial (~38 MB total, embutidos na imagem)
RUN mkdir -p /app/models \
    && curl -fsSL -o /app/models/face_detection_yunet_2023mar.onnx \
       "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx" \
    && curl -fsSL -o /app/models/face_recognition_sface_2021dec.onnx \
       "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

COPY pyproject.toml .

RUN pip install --no-cache-dir -e ".[dev]" || pip install --no-cache-dir -e .

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
