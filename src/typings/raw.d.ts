// Allow importing CSV files with ?raw (Vite)
declare module '*.csv?raw' {
  const content: string;
  export default content;
}
