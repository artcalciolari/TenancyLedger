import { defineConfig, devices } from '@playwright/test';

const integrationEnabled = process.env.E2E_INTEGRATION === '1';
const integrationBrowser = process.env.E2E_FULLSTACK_BROWSER ?? 'chromium';
/** Suítes fora do escopo dos projetos com API mockada. */
const nonMockedTestIgnore = ['**/integration/**', '**/visual/**'];
/** Só o projeto `ipad` executa as specs dedicadas ao viewport iPad. */
const mockedTestIgnore = [...nonMockedTestIgnore, '**/ipad/**'];
const reportDirectory = process.env.PLAYWRIGHT_HTML_OUTPUT_DIR ?? 'playwright-report';
const resultsDirectory = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results';
const frontendPort = process.env.PLAYWRIGHT_PORT ?? '5173';
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
/** Em CI servimos o bundle de produção; localmente o dev server mantém o HMR. */
const serveBuild = process.env.E2E_SERVE_BUILD === '1';

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
  workers: integrationEnabled ? 1 : process.env.CI ? 4 : undefined,
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
      testIgnore: nonMockedTestIgnore,
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
    command: serveBuild
      ? `npm run preview -- --host 127.0.0.1 --port ${frontendPort} --strictPort`
      : `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
    url: `${frontendUrl}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
