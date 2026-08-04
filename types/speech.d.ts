export {};

// Minimal ambient typing for the (still non-standard) Web Speech API.
// Declared loosely as `any` to avoid clashing with future official DOM types.
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}
