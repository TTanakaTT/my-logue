// Auto-exposed application version constant.
// Source of truth: package.json version field, injected via Vite define.
// During build/dev, Vite replaces __APP_VERSION__ with JSON string of the version.
// If type errors occur, ensure global.d.ts declares the symbol (added below if missing).

declare const __APP_VERSION__: string; // Provided by Vite define in vite.config.ts

export const APP_VERSION: string = __APP_VERSION__;
