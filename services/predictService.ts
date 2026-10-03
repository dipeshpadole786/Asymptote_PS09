import { iotSensorUrl } from "./sensorService";

export type CropScan = {
  crop: string;
  disease: string;
  confidence: number;
  diseaseConfidence: number;
  note: string | null;
};

type PredictBody = {
  crop?: unknown;
  disease?: unknown;
  confidence?: unknown;
  disease_confidence?: unknown;
  disease_note?: unknown;
  error?: unknown;
};

function apiOrigin(): string {
  const configured = iotSensorUrl();
  const match = configured?.match(/^(https?:\/\/[^/]+)/);
  return match?.[1] ?? "http://10.118.85.2:5001";
}

function readRatio(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value > 1 ? value / 100 : value;
}

/** Sends the photo to the existing predict_crop model. Returns only fields the model sent. */
export async function predictCropImage(imageBase64: string): Promise<CropScan> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(`${apiOrigin()}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
      signal: controller.signal,
    });
    const body = (await response.json()) as PredictBody;
    if (!response.ok) {
      const message = typeof body.error === "string" ? body.error : "The crop check failed.";
      throw new Error(message);
    }
    const confidence = readRatio(body.confidence);
    if (typeof body.crop !== "string" || !body.crop.trim() || confidence == null) {
      throw new Error("The model did not return a crop prediction.");
    }
    const diseaseConfidence = readRatio(body.disease_confidence) ?? 0;
    return {
      crop: body.crop.trim(),
      disease: typeof body.disease === "string" && body.disease.trim() ? body.disease.trim() : "unknown",
      confidence,
      diseaseConfidence,
      note: typeof body.disease_note === "string" ? body.disease_note : null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The crop check took too long. Try the photo again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
