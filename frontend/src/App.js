import { useState, useRef } from "react";
import "./App.css";
import WebcamFeed from "./components/WebcamFeed";
import { processSequence } from "./logic/sequenceProcessor";
import { speak } from "./logic/emergencyHandler";

const SIGNS = [
  { key: "CALL", emoji: "📞", label: "Call" },
  { key: "CHEST", emoji: "🫀", label: "Chest" },
  { key: "EMERGENCY", emoji: "🚨", label: "Emergency" },
  { key: "HELP", emoji: "🆘", label: "Help" },
  { key: "PAIN", emoji: "🤕", label: "Pain" },
  { key: "STOP", emoji: "🛑", label: "Stop" },
  { key: "TALK", emoji: "🗣️", label: "Talk" },
  { key: "YES", emoji: "👍", label: "Yes" },
];

const gestureToText = {
  CALL: "I need to make a call",
  CHEST: "My chest hurts",
  EMERGENCY: "This is an emergency",
  HELP: "I need help",
  PAIN: "I am in pain",
  STOP: "Stop",
  TALK: "I want to talk",
  YES: "Yes",
};

const gestureToImage = {
  CALL: "/images/call.png",
  CHEST: "/images/chest.png",
  EMERGENCY: "/images/emergency.png",
  HELP: "/images/help.png",
  PAIN: "/images/pain.png",
  STOP: "/images/stop.png",
  TALK: "/images/talk.png",
  YES: "/images/yes.png",
};

function App() {
  const [gesture, setGesture] = useState("None");
  const [confidence, setConfidence] = useState(0);
  const [sentence, setSentence] = useState("Awaiting gesture...");
  const [isRecording, setIsRecording] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predSource, setPredSource] = useState("");
  const [lastFrames, setLastFrames] = useState([]);

  // 🚨 Emergency state
  const [emergencyAlert, setEmergencyAlert] = useState("");

  const webcamRef = useRef(null);

  const handleSequence = async (frames) => {
    setIsRecording(false);
    setLastFrames(frames);

    if (frames.length < 5) {
      setSentence("Try again — move your hand into frame.");
      setGesture("None");
      setConfidence(0);
      setPredSource("");
      return;
    }

    setIsPredicting(true);
    setSentence("Analyzing gesture...");

    try {
      const result = await processSequence(frames);
      setGesture(result.gesture);
      setConfidence(result.confidence);
      setPredSource(result.source);
      setSentence(gestureToText[result.gesture] || "Gesture not recognised");
    } catch (err) {
      console.error("Prediction error:", err);
      setSentence("Prediction failed — try again.");
      setGesture("None");
      setConfidence(0);
      setPredSource("");
    } finally {
      setIsPredicting(false);
    }
  };

  const handleRecord = () => {
    if (!webcamRef.current) return;
    setIsRecording(true);
    webcamRef.current.startRecording();
  };

  // 🚨 Emergency Handler
  const handleEmergency = (type) => {
    const emergencyCases = {
      CHEST_PAIN: "Patient is experiencing chest pain",
      BREATHING: "Patient has breathing difficulty",
      SEVERE_PAIN: "Patient is in severe pain",
      DIZZINESS: "Patient feels dizzy",
      HELP: "Patient needs immediate help"
    };

    const message = emergencyCases[type];
    if (!message) return;

    setEmergencyAlert(message);
    speak(message);
  };

  const payloadPreview = JSON.stringify({
    detected_gesture: gesture,
    confidence: (confidence * 100).toFixed(1) + "%",
    translated: gestureToText[gesture] || null,
    frame_count: lastFrames.length,
    source: predSource || "—",
  }, null, 2);

  const hasGesture = gesture !== "None";

  const btnClass = isRecording
    ? "record-btn record-btn--recording"
    : isPredicting
      ? "record-btn record-btn--disabled"
      : "record-btn record-btn--ready";

  return (
    <>
      {/* HEADER */}
      <header className="kiosk-header">
        <span className="dot" />
        <h1>Sign-to-Text · Medical Gesture Kiosk</h1>
      </header>

      <div className="kiosk-layout">

        {/* LEFT PANEL */}
        <div className="camera-panel">
          <div className="camera-panel__feed">
            <WebcamFeed
              ref={webcamRef}
              onSequenceReady={handleSequence}
              isRecording={isRecording}
            />
          </div>

          <div className="camera-panel__footer">
            <div className="camera-footer__section">
              <div className="camera-footer__label">Detected Sign</div>
              <div className="detected-gesture">
                {isPredicting ? "⏳" : hasGesture ? gesture : "—"}
              </div>
              <div className="detected-sentence">
                {isPredicting ? "Analyzing gesture..." : sentence}
              </div>
              <div className="confidence-bar">
                <div
                  className="confidence-bar__fill"
                  style={{ width: `${(confidence * 100).toFixed(0)}%` }}
                />
              </div>
              {predSource && (
                <div className={`source-badge source-badge--${predSource}`}>
                  {predSource === "model" ? "🧠 LSTM Model" : "📏 Rule-based"}
                </div>
              )}
            </div>

            <div className="camera-footer__section gesture-preview">
              {gestureToImage[gesture] ? (
                <img src={gestureToImage[gesture]} alt={gesture} />
              ) : (
                <div className="no-gesture">🖐</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="side-panel">

          {/* Patient Input */}
          <div className="side-card">
            <div className="side-card__title">Patient Input</div>
            <button
              className={btnClass}
              onClick={handleRecord}
              disabled={isRecording || isPredicting}
            >
              {isRecording
                ? "⏺  Recording (3 s)…"
                : isPredicting
                  ? "⏳  Predicting…"
                  : "🖐  Start Gesture (3 s)"}
            </button>
            <div className={`status-text ${isRecording ? "status-text--recording"
              : isPredicting ? "status-text--loading"
                : "status-text--ready"
              }`}>
              {isRecording
                ? "Hold your gesture steady"
                : isPredicting
                  ? "Sending to model..."
                  : "Press to begin capture"}
            </div>
          </div>

          {/* 🚨 Emergency Mode */}
          <div className="side-card emergency-card">
            <div className="side-card__title">🚨 Emergency Mode</div>

            <div className="emergency-grid">
              <button onClick={() => handleEmergency("CHEST_PAIN")}>🫀 Chest Pain</button>
              <button onClick={() => handleEmergency("BREATHING")}>😮‍💨 Breathing</button>
              <button onClick={() => handleEmergency("SEVERE_PAIN")}>⚠️ Severe Pain</button>
              <button onClick={() => handleEmergency("DIZZINESS")}>😵 Dizziness</button>
              <button onClick={() => handleEmergency("HELP")}>🆘 Help</button>
            </div>

            {emergencyAlert && (
              <div className="emergency-alert">
                🚨 {emergencyAlert}
              </div>
            )}
          </div>

          {/* Sign Reference */}
          <div className="side-card">
            <div className="side-card__title">Sign Reference</div>
            <div className="sign-grid">
              {SIGNS.map((s) => (
                <div
                  key={s.key}
                  className={`sign-pill${gesture === s.key ? " active" : ""}`}
                >
                  <span className="sign-pill__emoji">{s.emoji}</span>
                  <span className="sign-pill__name">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payload */}
          <div className="side-card">
            <div className="side-card__title">Live Payload State</div>
            <pre className="payload-box">{payloadPreview}</pre>
          </div>

        </div>
      </div>
    </>
  );
}

export default App;