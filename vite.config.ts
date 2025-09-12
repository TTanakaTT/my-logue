import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: '/my-logue/' // GitHub Pages用 (リポジトリ名と一致させる)
});
