import json
import sys
from pathlib import Path

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1]
MODEL = YOLO(ROOT / "weights" / "best.pt")
DISEASE_MODEL_PATH = ROOT / "weights" / "disease.pt"
DISEASE_INFO_PATH = Path(__file__).resolve().parent / "disease_info.json"
SUPPORTED_DISEASE_CROPS = {"maize", "potato"}
MODEL.model.names = {
    index: name
    for index, name in enumerate(
        ["faba bean", "grassland", "maize", "mix", "potato", "rapeseed", "rice", "sorghum", "sugarbeet", "sunflower", "tobacco", "wheat"]
    )
}
DISEASE_MODEL = YOLO(DISEASE_MODEL_PATH) if DISEASE_MODEL_PATH.exists() else None
DISEASE_INFO = json.loads(DISEASE_INFO_PATH.read_text()) if DISEASE_INFO_PATH.exists() else {}
DISEASE_SUPPORTED_CROPS = {"maize", "potato"}
CROP_CONFIDENCE_THRESHOLD = 0.75


def predict_crop(image_path):
    result = MODEL.predict(source=image_path, verbose=False)[0]
    top_indices = result.probs.top5[:3]
    top3 = [(result.names[index], float(result.probs.data[index])) for index in top_indices]
    confidence = top3[0][1]
    crop_is_confident = confidence >= CROP_CONFIDENCE_THRESHOLD
    output = {
        "image_name": Path(image_path).name,
        "analysis_status": "complete" if crop_is_confident else "needs_review",
        "crop_class": top3[0][0] if crop_is_confident else "uncertain",
        "crop": top3[0][0] if crop_is_confident else "uncertain",
        "confidence": confidence,
        "top3": top3,
        "disease": "unknown",
        "disease_present": "unknown",
        "disease_status": "unavailable",
        "disease_confidence": 0.0,
        "recommended_treatment": None,
        "disease_information": None,
        "symptoms": None,
        "prevention": None,
        "treatment": None,
        "supported_disease_crops": sorted(DISEASE_SUPPORTED_CROPS),
        "next_action": "Review the image or upload a clearer leaf image." if not crop_is_confident else None,
        "disease_note": "No disease model is installed. VegAnn contains crop labels but no disease labels.",
    }
    if DISEASE_MODEL is None:
        output["disease_status"] = "model_unavailable"
        output["disease_note"] = "Disease model is not installed."
        return output
    disease_result = DISEASE_MODEL.predict(source=image_path, verbose=False)[0]
    disease_index = int(disease_result.probs.top1)
    disease_name = disease_result.names[disease_index]
    disease_confidence = float(disease_result.probs.data[disease_index])
    disease_crop = disease_name.split(" ", 1)[0] if " " in disease_name else None
    if disease_confidence >= 0.99 and disease_crop in DISEASE_SUPPORTED_CROPS and output["crop"] == "uncertain":
        output["crop"] = disease_crop
        output["crop_class"] = disease_crop
        output["crop_source"] = "disease-model fallback because crop confidence was low"
    if output["crop"] == "uncertain":
        output["disease_status"] = "uncertain"
        output["disease_present"] = "unknown"
        output["disease_note"] = "Crop confidence is too low for a safe disease diagnosis."
        return output
    if output["crop"] not in SUPPORTED_DISEASE_CROPS:
        output["disease"] = "not_assessed"
        output["disease_present"] = "not_assessed"
        output["disease_status"] = "coverage_unavailable"
        output["disease_note"] = "Authentic disease training coverage is currently limited to maize and potato."
        output["next_action"] = "Use a crop-specific disease model or consult an agronomist."
        return output
    if output["crop"] not in DISEASE_SUPPORTED_CROPS:
        output["disease_status"] = "unsupported"
        output["disease_note"] = "The installed disease dataset covers maize and potato only."
        return output
    output["disease_confidence"] = disease_confidence
    is_healthy = disease_name.lower().endswith(" healthy") or disease_name.lower() in {"healthy", "normal", "no disease"}
    if disease_confidence < 0.65 or is_healthy:
        output["disease"] = "healthy" if is_healthy else "uncertain"
        output["disease_status"] = "healthy" if output["disease"] == "healthy" else "uncertain"
        output["disease_present"] = "no" if is_healthy else "unknown"
    else:
        output["disease"] = disease_name
        output["disease_status"] = "detected"
        output["disease_present"] = "yes"
    output["disease_information"] = DISEASE_INFO.get(disease_name)
    if output["disease_information"]:
        output["symptoms"] = output["disease_information"].get("symptoms")
        output["prevention"] = output["disease_information"].get("prevention")
        output["treatment"] = output["disease_information"].get("treatment")
        output["recommended_treatment"] = output["treatment"]
    output["disease_note"] = "Disease output requires a disease-labeled model and should be confirmed by a local agronomist."
    output["next_action"] = "Review the disease guidance and confirm before treatment."
    return output


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python predict_crop.py <image_path>")
    print(json.dumps(predict_crop(sys.argv[1])))