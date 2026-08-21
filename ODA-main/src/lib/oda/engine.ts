// ODA On-Device Engine — the Adaptive Intelligence Core.
// Pure TypeScript, zero dependencies, zero network calls. Every response is
// forged locally in the user's browser: free forever, no keys, no credits,
// no vendor in the middle. Your documents never leave your device.
//
// Composition lives in adaptiveV2.ts (robust Sub:-/Ref:- parsing, subject
// quoting in every language, frequency-weighted classification); the language
// kits stay in adaptive.ts (shared with the Convex server action) so the
// client and server can never drift. This file is the public surface used by
// the app and the forge bench.

export {
  adaptiveGenerate,
  classifyType,
} from "./adaptiveV2";
export {
  kitFor,
  KITS,
  type AdaptiveDoc as EngineDocument,
  type AdaptiveOptions as EngineOptions,
  type AdaptiveResult as EngineResult,
  type LangKit,
} from "./adaptive";
