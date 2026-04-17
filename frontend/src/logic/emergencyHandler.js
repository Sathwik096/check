// logic/emergencyHandler.js

const emergencyCases = {
    chestPain: "Patient is experiencing chest pain",
    breathing: "Patient is having difficulty breathing",
    severePain: "Patient is in severe pain",
    dizziness: "Patient feels dizzy or may faint",
    help: "Patient needs immediate assistance"
};

// Text-to-Speech (Browser API)
export const speak = (text) => {
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-US";
    speech.volume = 1;
    speech.rate = 1;
    speech.pitch = 1;

    window.speechSynthesis.speak(speech);
};

// Main handler
export const triggerEmergency = (type) => {
    const message = emergencyCases[type];

    if (!message) return;

    // Speak
    speak(message);

    // Return message for UI
    return message;
};