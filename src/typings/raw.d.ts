// Allow importing CSV files with ?raw (Vite)
declare module '*.csv?raw' {
  const content: string;
  export default content;
}

// Global version placeholder injected by Vite define (vite.config.ts)
// Using var to place on global scope; actual replacement is a string literal.
declare const __APP_VERSION__: string;
