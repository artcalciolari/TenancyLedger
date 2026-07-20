import { defineConfig, devices } from '@playwright/test';

const integrationEnabled = process.env.E2E_INTEGRATION === '1';
const integrationBrowser = process.env.E2E_FULLSTACK_BROWSER ?? 'chromium';
const mockedTestIgnore = ['**/integration/**', '**/visual/**'];
const reportDirectory = process.env.PLAYWRIGHT_HTML_OUTPUT_DIR ?? 'playwright-report';
const resultsDirectory = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results';
const frontendPort = process.env.PLAYWRIGHT_PORT ?? '5173';
const frontendUrl = `http://127.0.0.1:${frontendPort}`;

const integrationDevice =
  integrationBrowser === 'firefox'
    ? devices['Desktop Firefox']
    : integrationBrowser === 'webkit'
      ? devices['Desktop Safari']
      : devices['Desktop Chrome'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !integrationEnabled,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI || integrationEnabled ? 3 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never', outputFolder: reportDirectory }], ['github']]
    : 'list',
  outputDir: resultsDirectory,
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: mockedTestIgnore, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testIgnore: mockedTestIgnore, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testIgnore: mockedTestIgnore, use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile-chromium',
      testIgnore: mockedTestIgnore,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-webkit',
      testIgnore: mockedTestIgnore,
      use: { ...devices['iPhone 15'] },
    },
    {
      name: 'ipad',
      testIgnore: mockedTestIgnore,
      use: {
        ...devices['iPad (gen 7) landscape'],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: 'visual-chromium-linux',
      testMatch: '**/visual/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        viewport: { width: 1280, height: 900 },
      },
    },
    ...(integrationEnabled
      ? [
          {
            name: `fullstack-${integrationBrowser}`,
            retries: 0,
            testMatch: '**/integration/**/*.spec.ts',
            use: { ...integrationDevice },
          },
        ]
      : []),
  ],
  snapshotPathTemplate: '{testDir}/{testFileDir}/__screenshots__/{arg}{ext}',
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
    url: `${frontendUrl}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
