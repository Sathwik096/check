"""
FastAPI backend for Sign-to-Text gesture prediction.

Loads a trained Keras LSTM model and exposes a /predict endpoint.
The model expects input shape (30, 126):
  - 30 frames
  - 126 features per frame (2 hands × 21 landmarks × 3 coords [x, y, z])
"""

import os
import json
import zipfile
import tempfile

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Reconstruct .keras file from extracted directory ──────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), "gesture_model (1).keras")
KERAS_FILE = os.path.join(os.path.dirname(__file__), "gesture_model.keras")

def reconstruct_keras_file():
    """
    The .keras format is actually a zip archive containing config.json,
    metadata.json, and model.weights.h5.  The user's model was saved as
    an extracted directory — re-zip it so Keras can load it properly.
    """
    if os.path.isfile(KERAS_FILE):
        return  # already built

    if not os.path.isdir(MODEL_DIR):
        raise FileNotFoundError(f"Model directory not found: {MODEL_DIR}")

    with zipfile.ZipFile(KERAS_FILE, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in ["config.json", "metadata.json", "model.weights.h5"]:
            fpath = os.path.join(MODEL_DIR, fname)
            if os.path.isfile(fpath):
                zf.write(fpath, fname)

    print(f"[OK] Reconstructed {KERAS_FILE}")


# ── Load model at import time ────────────────────────────────────
reconstruct_keras_file()

import tensorflow as tf  # imported after zip so TF doesn't slow startup msgs
model = tf.keras.models.load_model(KERAS_FILE)
print("[OK] Model loaded successfully")
print(f"   Input shape : {model.input_shape}")
print(f"   Output shape: {model.output_shape}")

# Class labels — alphabetical order (matches os.listdir on most systems).
# NOTE: Adjust this list if your training folder order was different!
ACTIONS = sorted(["CALL", "CHEST", "EMERGENCY", "HELP", "PAIN", "STOP", "TALK", "YES"])
print(f"   Classes     : {ACTIONS}")

# ── FastAPI app ──────────────────────────────────────────────────
app = FastAPI(title="Sign-to-Text Gesture API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    """
    sequence: list of 30 frames, each frame is a list of 126 floats.
    """
    sequence: list[list[float]]

class PredictResponse(BaseModel):
    gesture: str
    confidence: float
    all_predictions: dict[str, float]


@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    seq = np.array(req.sequence, dtype=np.float32)

    # ── Validate shape ────────────────────────────────────────────
    if seq.ndim != 2 or seq.shape[1] != 126:
        raise HTTPException(
            status_code=400,
            detail=f"Expected shape (N, 126), got {seq.shape}",
        )
    # ── Pad / truncate to exactly 30 frames ───────────────────────
    n_frames = seq.shape[0]
    if n_frames < 30:
        padding = np.zeros((30 - n_frames, 126), dtype=np.float32)
        seq = np.concatenate([seq, padding], axis=0)
    elif n_frames > 30:
        # Evenly sample 30 frames
        indices = np.linspace(0, n_frames - 1, 30, dtype=int)
        seq = seq[indices]

    # ── Normalise (same as training) ──────────────────────────────
    max_val = np.max(seq)
    seq = seq / (max_val + 1e-6)

    # ── Predict ───────────────────────────────────────────────────
    X = seq[np.newaxis, ...]          # (1, 30, 126)
    probs = model.predict(X, verbose=0)[0]   # (8,)

    best_idx = int(np.argmax(probs))
    gesture = ACTIONS[best_idx]
    confidence = float(probs[best_idx])

    all_preds = {action: round(float(probs[i]), 4) for i, action in enumerate(ACTIONS)}

    return PredictResponse(
        gesture=gesture,
        confidence=round(confidence, 4),
        all_predictions=all_preds,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
