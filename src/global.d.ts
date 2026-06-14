export {};

declare global {
  // Vendor side-effect module (src/vendor/voice-karaoke.js) attaches this global,
  // consumed by the composer / voice components.
  interface Window {
    VoiceKaraoke?: {
      wrapWords: (text: string) => string;
      start: (el: Element, dur: number, onEnd?: () => void) => void;
      pause: (el: Element) => void;
    };
  }
}
