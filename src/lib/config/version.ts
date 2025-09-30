// Auto-exposed application version constant.
// Source of truth: package.json version field, injected via Vite define.
// During build/dev, Vite replaces __APP_VERSION__ with JSON string of the version.
// If type errors occur, ensure global.d.ts declares the symbol (added below if missing).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const __APP_VERSION__: any; // Provided by Vite define in vite.config.ts

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
