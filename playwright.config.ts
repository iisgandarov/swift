import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    trace: "off",
    permissions: ["microphone"],
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  projects: [
    { name: "light", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, colorScheme: "light", permissions: ["microphone"] } },
    { name: "dark", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, colorScheme: "dark", permissions: ["microphone"] } },
  ],
  webServer: {
    // demo mode: in-memory store, fake user, mocked AI/Calendar — no keys needed
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { SWIFT_DEMO: "1", NEXT_PUBLIC_SUPABASE_URL: "" },
  },
});
