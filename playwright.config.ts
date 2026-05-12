/*
 * 文件说明：该文件配置 Playwright 浏览器端 E2E 测试。
 * 功能说明：指定测试目录、基础地址和本地 dev server 启动方式。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：测试配置
 */
import { defineConfig, devices } from "@playwright/test";

const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: process.env.APP_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure"
  },
  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command: "npm.cmd run dev",
          url: process.env.APP_URL || "http://127.0.0.1:3000",
          reuseExistingServer: true,
          timeout: 120_000
        }
      }),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
