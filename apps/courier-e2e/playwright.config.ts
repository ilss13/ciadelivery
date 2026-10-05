import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    trace: 'off',
    ...devices['Pixel 5'],
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
