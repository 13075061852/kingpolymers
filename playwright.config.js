import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const windows = process.platform === 'win32';
const localPython = windows ? 'runtime/venv/Scripts/python.exe' : 'runtime/venv/bin/python';
const python = existsSync(localPython) ? JSON.stringify(localPython) : 'python';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  outputDir: 'runtime/test-artifacts',
  reporter: [['list'], ['json', { outputFile: 'runtime/test-artifacts/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:8740',
    channel: windows ? 'msedge' : undefined,
    viewport: { width: 1600, height: 1050 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--enable-webgl', '--ignore-gpu-blocklist'] },
  },
  webServer: [
    {
      command: python + ' tests/backend/serve_browser.py --port 8740',
      url: 'http://127.0.0.1:8740/api/auth/session',
      reuseExistingServer: false,
    },
    {
      command: python + ' tests/backend/serve_browser.py --port 8741 --auth',
      url: 'http://127.0.0.1:8741/api/auth/session',
      reuseExistingServer: false,
    },
  ],
});
