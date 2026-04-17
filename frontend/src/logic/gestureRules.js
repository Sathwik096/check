export function classifyGesture(handsFeatures) {
  if (!handsFeatures || handsFeatures.length === 0) return "UNKNOWN";

  // Helper checks for specific hand shapes
  const isFlat = (f) => f.thumbUp && f.indexUp && f.middleUp && f.ringUp && f.pinkyUp;
  const isFlatNoThumb = (f) => !f.thumbUp && f.indexUp && f.middleUp && f.ringUp && f.pinkyUp;
  const isFist = (f) => !f.thumbUp && !f.indexUp && !f.middleUp && !f.ringUp && !f.pinkyUp;
  const isIndexUp = (f) => !f.thumbUp && f.indexUp && !f.middleUp && !f.ringUp && !f.pinkyUp;
  const isThumbsUp = (f) => f.thumbUp && !f.indexUp && !f.middleUp && !f.ringUp && !f.pinkyUp;

  // Check two-handed gestures first
  if (handsFeatures.length >= 2) {
    const [f1, f2] = handsFeatures;

    // 🛑 STOP: Both hands open (flat)
    if ((isFlat(f1) || isFlatNoThumb(f1)) && (isFlat(f2) || isFlatNoThumb(f2))) {
      return "CHEST";
    }

    // 🚨 EMERGENCY: Both hands fists
    if (isFist(f1) && isFist(f2)) {
      return "EMERGENCY";
    }

    // 🆘 HELP: One hand thumbs up, one hand open palm
    const hasThumbsUp = isThumbsUp(f1) || isThumbsUp(f2);
    const hasFlat = isFlat(f1) || isFlatNoThumb(f1) || isFlat(f2) || isFlatNoThumb(f2);
    if (hasThumbsUp && hasFlat && (!isThumbsUp(f1) || !isThumbsUp(f2))) {
      return "HELP";
    }

    // 🤕 PAIN: Both hands index fingers pointing
    if (isIndexUp(f1) && isIndexUp(f2)) {
      return "PAIN";
    }
  }

  // Fallback to checking any hand for one-handed gestures
  for (const f of handsFeatures) {
    const { thumbUp, indexUp, middleUp, ringUp, pinkyUp } = f;

    // 🫀 CHEST: All fingers up (Open hand on chest)
    if (thumbUp && indexUp && middleUp && ringUp && pinkyUp) {
      return "STOP";
    }

    // 🗣️ TALK: Thumb, Index, Middle up (the "3" shape)
    if (thumbUp && indexUp && middleUp && !ringUp && !pinkyUp) {
      return "TALK";
    }

    // 📞 CALL: Thumb and Pinky up (phone sign)
    if (thumbUp && !indexUp && !middleUp && !ringUp && pinkyUp) {
      return "CALL";
    }

    // 👍 YES: Thumbs up only
    if (thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) {
      return "YES";
    }
  }

  return "UNKNOWN";
}