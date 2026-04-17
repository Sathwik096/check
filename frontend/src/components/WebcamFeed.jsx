import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

const WebcamFeed = forwardRef(function WebcamFeed({ onSequenceReady, isRecording }, ref) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading MediaPipe...");

  const recordingRef = useRef(false);
  const buffer = useRef([]);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const initialized = useRef(false);

  useImperativeHandle(ref, () => ({
    startRecording,
    getStatus: () => status,
  }));

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.crossOrigin = "anonymous"; // ✅ important fix
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(s);
      });

    const init = async () => {
      try {
        // ✅ USE STABLE VERSION (FIXED)
        const MP_VERSION = "0.4";

        await loadScript(`https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MP_VERSION}/hands.js`);
        await loadScript(`https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js`);
        await loadScript(`https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js`);

        setStatus("Requesting camera...");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        setStatus("Starting hand tracking...");

        // ✅ FIXED locateFile
        const hands = new window.Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MP_VERSION}/${file}`,
        });

        hands.setOptions({
          maxNumHands: 4,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results) => {
          if (!canvasRef.current || !videoRef.current) return;

          const ctx = canvasRef.current.getContext("2d");
          ctx.save();
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);

          if (results.multiHandLandmarks?.length > 0) {
            if (recordingRef.current) {
              buffer.current.push(results.multiHandLandmarks);
            }

            for (const landmarks of results.multiHandLandmarks) {
              window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
                color: "#22d3a0",
                lineWidth: 2,
              });
              window.drawLandmarks(ctx, landmarks, {
                color: "#ffffff",
                lineWidth: 1,
                radius: 3,
              });
            }
          }
          ctx.restore();
        });

        handsRef.current = hands;

        let lastFrameTime = 0;
        let animId;

        const sendFrame = async () => {
          animId = requestAnimationFrame(sendFrame);
          const now = Date.now();
          if (now - lastFrameTime < 100) return;
          lastFrameTime = now;

          if (!videoRef.current || videoRef.current.readyState < 2) return;

          try {
            await hands.send({ image: videoRef.current });
          } catch (err) {
            console.warn("Frame send error:", err);
          }
        };

        animId = requestAnimationFrame(sendFrame);
        cameraRef.current = { stop: () => cancelAnimationFrame(animId) };

        setStatus("Ready");
      } catch (err) {
        console.error("MediaPipe init error:", err);
        setStatus(`Error: ${err.message}`);
      }
    };

    init();

    return () => {
      cameraRef.current?.stop();
      handsRef.current?.close();

      const video = videoRef.current;
      if (video?.srcObject) {
        video.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = () => {
    if (status !== "Ready") return;

    buffer.current = [];
    recordingRef.current = true;

    setTimeout(() => {
      recordingRef.current = false;
      onSequenceReady(buffer.current);
    }, 3000);
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ display: "none" }} />

      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          transform: "scaleX(-1)",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          background: "#0a1120",
          outline: isRecording ? "3px solid #ef4444" : "none",
        }}
      />

      <div style={{
        position: "absolute",
        top: 12,
        right: 12,
        padding: "4px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        background: status === "Ready"
          ? (isRecording ? "rgba(239,68,68,0.85)" : "rgba(34,211,160,0.15)")
          : "rgba(245,158,11,0.15)",
        color: status === "Ready"
          ? (isRecording ? "#fff" : "#22d3a0")
          : "#f59e0b",
        border: `1px solid ${status === "Ready"
          ? (isRecording ? "#ef4444" : "#22d3a0")
          : "#f59e0b"}`,
        backdropFilter: "blur(4px)",
      }}>
        {isRecording ? "⏺ RECORDING" : status === "Ready" ? "● LIVE" : `⏳ ${status}`}
      </div>
    </div>
  );
});

export default WebcamFeed;