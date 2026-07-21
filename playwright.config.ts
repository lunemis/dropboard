import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3015;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && node scripts/e2e-server.mjs",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DROPBOARD_DATA_DIR: path.join(process.cwd(), ".e2e-data", "items"),
      DROPBOARD_TOKEN: "e2e-token-that-is-at-least-24-characters",
      DROPBOARD_PIN: "123456",
      DROPBOARD_SESSION_SECRET:
        "e2e-session-secret-that-is-at-least-32-characters",
      NEXT_PUBLIC_DROPBOARD_LOCALE: "en",
      DROPBOARD_E2E_PORT: String(port),
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
