import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'pnpm run build && pnpm run preview',
    port: 4173
  },
  testDir: 'tests/e2e',
  reporter: process.env.CI ? 'github' : 'html',
  // Run tests for both ja/en locales across desktop and mobile profiles.
  // Locale is selected via PARAGLIDE_LOCALE cookie to match app's strategy.
  projects: [
    // Desktop Chrome
    {
      name: 'chromium-hd-ja',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1080 },
        locale: 'ja-JP',
        storageState: {
          cookies: [
            {
              name: 'PARAGLIDE_LOCALE',
              value: 'ja',
              domain: 'localhost',
              path: '/',
              expires: 2147483647,
              httpOnly: false,
              secure: false,
              sameSite: 'Lax'
            }
          ],
          origins: []
        }
      }
    },
    {
      name: 'chromium-hd-en',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1080 },
        locale: 'en-US',
        storageState: {
          cookies: [
            {
              name: 'PARAGLIDE_LOCALE',
              value: 'en',
              domain: 'localhost',
              path: '/',
              expires: 2147483647,
              httpOnly: false,
              secure: false,
              sameSite: 'Lax'
            }
          ],
          origins: []
        }
      }
    },
    // Mobile Safari (iPhone 13)
    {
      name: 'mobile-safari-ja',
      use: {
        ...devices['iPhone 13'],
        locale: 'ja-JP',
        storageState: {
          cookies: [
            {
              name: 'PARAGLIDE_LOCALE',
              value: 'ja',
              domain: 'localhost',
              path: '/',
              expires: 2147483647,
              httpOnly: false,
              secure: false,
              sameSite: 'Lax'
            }
          ],
          origins: []
        }
      }
    },
    {
      name: 'mobile-safari-en',
      use: {
        ...devices['iPhone 13'],
        locale: 'en-US',
        storageState: {
          cookies: [
            {
              name: 'PARAGLIDE_LOCALE',
              value: 'en',
              domain: 'localhost',
              path: '/',
              expires: 2147483647,
              httpOnly: false,
              secure: false,
              sameSite: 'Lax'
            }
          ],
          origins: []
        }
      }
    }
  ],
  outputDir: 'test-results/'
});
