let lastGesture = "";
let stableCount = 0;

export function stabilize(gesture) {
  if (gesture === lastGesture) {
    stableCount++;
  } else {
    stableCount = 0;
  }

  lastGesture = gesture;

  if (stableCount > 6) {
    return gesture;
  }

  return null;
}