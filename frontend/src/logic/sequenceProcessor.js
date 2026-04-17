import { extractFeatures } from "./featureExtractor";
import { classifyGesture } from "./gestureRules";

const API_URL = "http://localhost:8000/predict";

/**
 * Convert a single frame of multiHandLandmarks into a flat array of 126 floats.
 * Layout: [leftHand(21×3), rightHand(21×3)]
 * If only one hand detected, the other is padded with zeros.
 */
function frameToFeatures(frameHands) {
  // Each hand: 21 landmarks × 3 coords = 63 floats
  const HAND_SIZE = 21 * 3;

  const leftHand  = new Array(HAND_SIZE).fill(0);
  const rightHand = new Array(HAND_SIZE).fill(0);

  if (!frameHands || frameHands.length === 0) {
    return [...leftHand, ...rightHand];
  }

  // Fill first hand into "left" slot
  if (frameHands[0]) {
    for (let i = 0; i < 21; i++) {
      const lm = frameHands[0][i];
      if (lm) {
        leftHand[i * 3]     = lm.x;
        leftHand[i * 3 + 1] = lm.y;
        leftHand[i * 3 + 2] = lm.z;
      }
    }
  }

  // Fill second hand into "right" slot
  if (frameHands[1]) {
    for (let i = 0; i < 21; i++) {
      const lm = frameHands[1][i];
      if (lm) {
        rightHand[i * 3]     = lm.x;
        rightHand[i * 3 + 1] = lm.y;
        rightHand[i * 3 + 2] = lm.z;
      }
    }
  }

  return [...leftHand, ...rightHand]; // 126 floats
}

/**
 * Rule-based fallback (original logic).
 */
function processSequenceLocal(frames) {
  if (!frames || frames.length === 0) {
    return { gesture: "NONE", confidence: 0 };
  }

  const counts = {};
  let validFrames = 0;

  frames.forEach((frameHands) => {
    if (!frameHands || !Array.isArray(frameHands) || frameHands.length === 0) return;

    const handsFeatures = frameHands
      .map((landmarks) => {
        if (!landmarks || landmarks.length !== 21) return null;
        return extractFeatures(landmarks);
      })
      .filter((f) => f !== null);

    if (handsFeatures.length === 0) return;

    const gesture = classifyGesture(handsFeatures);

    if (gesture !== "UNKNOWN") {
      counts[gesture] = (counts[gesture] || 0) + 1;
      validFrames++;
    }
  });

  if (validFrames === 0) {
    return { gesture: "UNKNOWN", confidence: 0 };
  }

  let maxGesture = null;
  let maxCount = 0;
  for (const gesture in counts) {
    if (counts[gesture] > maxCount) {
      maxGesture = gesture;
      maxCount = counts[gesture];
    }
  }

  const confidence = maxCount / validFrames;
  return {
    gesture: maxGesture,
    confidence: parseFloat(confidence.toFixed(2)),
  };
}

/**
 * Main entry point — tries the LSTM model API first, falls back to rules.
 *
 * @param {Array} frames - array of multiHandLandmarks per frame
 * @returns {Promise<{gesture: string, confidence: number, source: string}>}
 */
export async function processSequence(frames) {
  if (!frames || frames.length === 0) {
    return { gesture: "NONE", confidence: 0, source: "none" };
  }

  // ── Build the 30×126 feature matrix ──────────────────────────
  const sequence = frames.map((frameHands) => frameToFeatures(frameHands));

  // ── Try the LSTM model via API ───────────────────────────────
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("🧠 Model prediction:", data);

    return {
      gesture: data.gesture,
      confidence: parseFloat(data.confidence.toFixed(2)),
      source: "model",
      allPredictions: data.all_predictions,
    };
  } catch (err) {
    console.warn("⚠️ Model API unavailable, using rule-based fallback:", err.message);
    const fallback = processSequenceLocal(frames);
    return { ...fallback, source: "rules" };
  }
}