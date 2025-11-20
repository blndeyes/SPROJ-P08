import io
import json
import time
from typing import List, Dict, Any

import numpy as np
import torch
import torch.nn.functional as F
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

# simple fastapi service that runs the model and returns a diagnosis
ARTIFACT_DIR = "artifacts"
MODEL_PATH = f"{ARTIFACT_DIR}/model_traced.pt"
CLASS_INDEX_PATH = f"{ARTIFACT_DIR}/class_index.json"
PREPROCESS_PATH = f"{ARTIFACT_DIR}/preprocess.json"

class DiagnoseResponse(BaseModel):
    diagnosis: str
    confidence: float
    alternatives: List[Dict[str, Any]]
    recommendations: List[str]
    processing_ms: int

# allow calling this service from frontend/backend
app = FastAPI(title="AgriQual ML Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# prefer gpu if available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# load label map and preprocess settings
with open(CLASS_INDEX_PATH, "r") as f:
    raw_map = json.load(f)
class_index = {int(k): v for k, v in raw_map.items()}

with open(PREPROCESS_PATH, "r") as f:
    preprocess_cfg = json.load(f)
input_w, input_h = int(preprocess_cfg["input_size"][0]), int(preprocess_cfg["input_size"][1])
mean = torch.tensor(preprocess_cfg["normalize_mean"], dtype=torch.float32).view(3, 1, 1)
std = torch.tensor(preprocess_cfg["normalize_std"], dtype=torch.float32).view(3, 1, 1)

# load torchscript model once at startup
model = torch.jit.load(MODEL_PATH, map_location=device)
model.eval()

# resize, normalize and batch an image for inference
def prepare(image: Image.Image) -> torch.Tensor:
    img = image.convert("RGB").resize((input_w, input_h))
    arr = np.asarray(img).astype("float32") / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    x = torch.from_numpy(arr)
    x = (x - mean) / std
    x = x.unsqueeze(0).to(device)
    return x

# get top k softmax probs and indices
def topk_from_logits(logits: torch.Tensor, k: int = 3):
    probs = F.softmax(logits, dim=1)
    values, indices = torch.topk(probs, k=min(k, probs.shape[1]), dim=1)
    return values.squeeze(0).tolist(), indices.squeeze(0).tolist()

# basic text recommendations per label
def recs_for_label(label: str) -> List[str]:
    if label.lower() == "healthy":
        return ["No immediate action needed"]
    if "rust" in label.lower():
        return ["Consider fungicide", "Inspect adjacent plots"]
    if "blight" in label.lower():
        return ["Remove infected leaves", "Improve field sanitation"]
    return ["Inspect field conditions", "Monitor over next 48 hours"]

@app.post("/api/diagnose", response_model=DiagnoseResponse)
async def diagnose(image: UploadFile = File(...)):
    # validate and parse input image
    start = time.time()
    if image.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=415, detail="Unsupported media type")
    data = await image.read()
    try:
        pil = Image.open(io.BytesIO(data))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")
    # run model and build response
    with torch.no_grad():
        x = prepare(pil)
        logits = model(x)
        values, indices = topk_from_logits(logits, k=3)
    top_label = class_index.get(int(indices[0]), str(indices[0]))
    top_conf = float(values[0])
    alts = []
    for i in range(1, len(indices)):
        al_label = class_index.get(int(indices[i]), str(indices[i]))
        al_conf = float(values[i])
        alts.append({"label": al_label, "confidence": al_conf})
    payload = {
        "diagnosis": top_label,
        "confidence": top_conf,
        "alternatives": alts,
        "recommendations": recs_for_label(top_label),
        "processing_ms": int((time.time() - start) * 1000)
    }
    return DiagnoseResponse(**payload)
