import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'pnpm run build && pnpm run preview',
    port: 4173
  },
  testDir: 'tests/e2e',
  reporter: process.env.CI ? 'github' : 'html',
  // Run tests for both ja/en locales across desktop and mobile profiles.
  projects: [
    // Desktop Chrome
    {
      name: 'chromium-hd-ja',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1080 },
        locale: 'ja-JP'
      }
    },
    {
      name: 'chromium-hd-en',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1080 },
        locale: 'en-US'
      }
    },
    // Mobile Safari (iPhone 13)
    {
      name: 'mobile-safari-ja',
      use: {
        ...devices['iPhone 13'],
        locale: 'ja-JP'
      }
    },
    {
      name: 'mobile-safari-en',
      use: {
        ...devices['iPhone 13'],
        locale: 'en-US'
      }
    }
  ],
  outputDir: 'test-results/'
});
