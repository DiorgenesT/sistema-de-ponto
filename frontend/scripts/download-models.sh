#!/usr/bin/env bash
# Baixa os modelos necessários do face-api.js para /public/models/
# Executar uma vez antes do primeiro build: bash scripts/download-models.sh

set -euo pipefail

BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
DEST="$(dirname "$0")/../public/models"

mkdir -p "$DEST"

FILES=(
  "tiny_face_detector_model-weights_manifest.json"
  "tiny_face_detector_model-shard1"
  "face_landmark_68_tiny_model-weights_manifest.json"
  "face_landmark_68_tiny_model-shard1"
)

echo "Baixando modelos face-api.js para $DEST ..."

for file in "${FILES[@]}"; do
  if [ -f "$DEST/$file" ]; then
    echo "  já existe: $file"
  else
    echo "  baixando: $file"
    curl -fsSL "$BASE_URL/$file" -o "$DEST/$file"
  fi
done

echo "Concluído. Modelos em public/models/"
