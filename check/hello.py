import cv2
import numpy as np
import mediapipe as mp
import tensorflow as tf

# Load your model
model = tf.keras.models.load_model("../backend/gesture_model.keras")

ACTIONS = ["CALL", "CHEST", "EMERGENCY", "HELP", "PAIN", "STOP", "TALK", "YES"]

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

sequence = []
cap = cv2.VideoCapture(0)

with mp_hands.Hands(
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
) as hands:

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(image)

        keypoints = []

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                for lm in hand_landmarks.landmark:
                    keypoints.extend([lm.x, lm.y, lm.z])

            # Pad if only one hand detected
            while len(keypoints) < 126:
                keypoints.extend([0, 0, 0])
        else:
            keypoints = [0] * 126

        sequence.append(keypoints)
        sequence = sequence[-30:]  # keep last 30 frames

        # Predict when we have 30 frames
        if len(sequence) == 30:
            seq = np.array(sequence)

            # Normalize
            seq = seq / (np.max(seq) + 1e-6)

            X = np.expand_dims(seq, axis=0)
            probs = model.predict(X, verbose=0)[0]

            action = ACTIONS[np.argmax(probs)]
            confidence = np.max(probs)

            cv2.putText(frame, f"{action} ({confidence:.2f})",
                        (10, 40), cv2.FONT_HERSHEY_SIMPLEX,
                        1, (0, 255, 0), 2)

        cv2.imshow("Gesture Test", frame)

        if cv2.waitKey(10) & 0xFF == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()