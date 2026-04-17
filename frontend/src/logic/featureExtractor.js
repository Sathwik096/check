export function extractFeatures(landmarks) {
  if (!landmarks || landmarks.length < 21) return null;

  // Helper to check if a finger is extended
  // In MediaPipe, Y decreases as you move UP the screen
  const isFingerUp = (tipIdx, pipIdx) => landmarks[tipIdx].y < landmarks[pipIdx].y;

  return {
    thumbUp:
     Math.abs(landmarks[4].x - landmarks[3].x) > 0.04, // Basic check for thumb
    indexUp: isFingerUp(8, 6),
    middleUp: isFingerUp(12, 10),
    ringUp: isFingerUp(16, 14),
    pinkyUp: isFingerUp(20, 18),
    wrist: landmarks[0]
  };
}