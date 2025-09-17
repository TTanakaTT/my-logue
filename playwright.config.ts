import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'pnpm run build && pnpm run preview',
    port: 4173
  },
  testDir: 'tests/e2e',
  reporter: process.env.CI ? 'github' : 'html',
  projects: [
    {
      name: 'chromium-hd',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1080 }
      }
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 13']
      }
    }
  ],
  outputDir: 'test-results/'
});
