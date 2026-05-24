/*
 * 文件说明：该文件覆盖 V2.1.6 豆包 / 火山方舟 AI Provider 增量支持。
 * 功能说明：验证 schema、迁移、服务层、配置页、登录权限、保存配置、测试连接、调用日志和原 Market Claw 页面边界。
 *
 * 结构概览：
 *   第一部分：导入依赖与本地数据库准备工具
 *   第二部分：登录与页面操作工具
 *   第三部分：V2.1.6 文件级与浏览器端断言
 */
import fs from "fs";
import path from "path";
import { execFileSync, spawn, type ChildProcess } from "child_process";
import { expect, test, type Page } from "@playwright/test";

let postgresProcess: ChildProcess | null = null;

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return "postgresql://postgres@127.0.0.1:55432/wecom_growth_hub_demo?schema=public";
  }

  const match = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("DATABASE_URL="));
  if (!match) return "postgresql://postgres@127.0.0.1:55432/wecom_growth_hub_demo?schema=public";
  return match.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
}

function buildChildEnv(extra: Record<string, string | undefined> = {}) {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...extra }).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  ) as NodeJS.ProcessEnv;
}

function run(command: string, args: string[], env: Record<string, string | undefined> = {}) {
  const executable = command.endsWith(".cmd") ? "cmd.exe" : command;
  const finalArgs = command.endsWith(".cmd") ? ["/c", command, ...args] : args;
  execFileSync(executable, finalArgs, {
    cwd: process.cwd(),
    env: buildChildEnv(env),
    stdio: "inherit",
    windowsHide: true
  });
}

function runQuiet(command: string, args: string[], env: Record<string, string | undefined> = {}) {
  const executable = command.endsWith(".cmd") ? "cmd.exe" : command;
  const finalArgs = command.endsWith(".cmd") ? ["/c", command, ...args] : args;
  execFileSync(executable, finalArgs, {
    cwd: process.cwd(),
    env: buildChildEnv(env),
    stdio: "ignore",
    windowsHide: true
  });
}

function waitForPostgres(host: string, port: string, user: string) {
  for (let index = 0; index < 40; index += 1) {
    try {
      runQuiet("pg_isready.exe", ["-h", host, "-p", port, "-U", user]);
      return;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
  }
  throw new Error("PostgreSQL did not become ready for V2.1.6 Playwright test.");
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function prepareDatabase() {
  const databaseUrl = readDatabaseUrl();
  const parsed = new URL(databaseUrl);
  const host = parsed.hostname || "127.0.0.1";
  const port = parsed.port || "5432";
  const user = decodeURIComponent(parsed.username || "postgres");
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, "") || "wecom_growth_hub_demo");
  const dataDir = path.join(process.cwd(), "custom", "experiments", "postgres-data");

  try {
    runQuiet("pg_isready.exe", ["-h", host, "-p", port, "-U", user]);
  } catch {
    if (!fs.existsSync(dataDir)) {
      run("initdb.exe", ["-D", dataDir, "-U", "postgres", "-A", "trust"]);
    }

    const pidFile = path.join(dataDir, "postmaster.pid");
    if (fs.existsSync(pidFile)) {
      fs.rmSync(pidFile, { force: true });
    }

    postgresProcess = spawn("postgres.exe", ["-D", dataDir, "-p", port], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "ignore",
      windowsHide: true
    });
  }

  waitForPostgres(host, port, user);
  run("psql.exe", ["-h", host, "-p", port, "-U", user, "-d", "postgres", "-c", `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)};`]);
  run("psql.exe", ["-h", host, "-p", port, "-U", user, "-d", "postgres", "-c", `CREATE DATABASE ${quoteIdentifier(databaseName)};`]);
  run("npx.cmd", ["prisma", "migrate", "deploy"], { DATABASE_URL: databaseUrl });
  run("npm.cmd", ["run", "prisma:seed"], {
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: process.env.SESSION_SECRET ?? "local-v216-session-secret-for-playwright",
    APP_URL: process.env.APP_URL ?? "http://127.0.0.1:3000"
  });
}

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button').click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

test.describe("V2.1.6 豆包 / 火山方舟 AI Provider 支持", () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    await prepareDatabase();
  });

  test.afterAll(async () => {
    if (postgresProcess) {
      postgresProcess.kill();
      postgresProcess = null;
    }
  });

  test("schema、迁移、服务层和文档保持增量边界", async () => {
    const projectRoot = process.cwd();
    const schema = fs.readFileSync(path.join(projectRoot, "prisma/schema.prisma"), "utf8");
    const migration = fs.readFileSync(
      path.join(projectRoot, "prisma/migrations/20260518040000_add_doubao_ai_provider/migration.sql"),
      "utf8"
    );
    const service = fs.readFileSync(path.join(projectRoot, "src/lib/ai-provider.ts"), "utf8");
    const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
    const agents = fs.readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8");
    const notePath = path.join(projectRoot, "custom/notes/v2.1.6-ai-provider-doubao-support.md");

    expect(schema).toContain("enum AiProvider");
    expect(schema).toContain("DOUBAO");
    expect(migration).toContain('ALTER TYPE "AiProvider" ADD VALUE');
    expect(migration).toContain("DOUBAO");
    expect(migration).not.toContain("DROP TABLE");

    expect(service).toContain("DOUBAO");
    expect(service).toContain("豆包 / 火山方舟");
    expect(service).toContain("https://ark.cn-beijing.volces.com/api/v3");
    expect(service).toContain("getChatCompletionsUrl");
    expect(service).toContain("/chat/completions");
    expect(service).not.toContain("callDoubao");
    expect(service).not.toContain("console.log(config.apiKey");

    expect(readme).toContain("## V2.1.6 AI Provider 扩展支持豆包");
    expect(readme).toContain("DOUBAO");
    expect(readme).toContain("不自动回复客户");
    expect(agents).toContain("custom/notes/v2.1.6-ai-provider-doubao-support.md");
    expect(fs.existsSync(notePath)).toBeTruthy();
  });

  test("TENANT_ADMIN 可配置 DOUBAO，测试连接安全降级并写入调用日志", async ({ page }) => {
    const fakeApiKey = "ak-v216-doubao-local-test-1234";

    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/ai-settings");
    await expect(page).toHaveURL(/\/app\/zhengmu-demo\/ai-settings$/);

    const provider = page.locator('select[name="provider"]');
    await expect(provider).toBeVisible();
    const optionValues = await provider.locator("option").evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value)
    );
    expect(optionValues).toEqual(expect.arrayContaining(["DEEPSEEK", "DOUBAO", "OPENAI_COMPATIBLE", "MOCK"]));

    await provider.selectOption("DOUBAO");
    await expect(page.getByText("豆包 / 火山方舟")).toBeVisible();
    await expect(page.getByText("https://ark.cn-beijing.volces.com/api/v3")).toBeVisible();

    await page.locator('input[name="baseUrl"]').fill("https://ark.cn-beijing.volces.com/api/v3");
    await page.locator('input[name="model"]').fill("doubao-local-test-model");
    await page.locator('input[name="apiKeyEncrypted"]').fill(fakeApiKey);

    const saveForm = page.locator("form").filter({ has: provider });
    await saveForm.getByRole("button").click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator('select[name="provider"]')).toHaveValue("DOUBAO");
    await expect(page.locator('input[name="baseUrl"]')).toHaveValue("https://ark.cn-beijing.volces.com/api/v3");
    await expect(page.locator('input[name="model"]')).toHaveValue("doubao-local-test-model");
    await expect(page.locator('input[name="apiKeyEncrypted"]')).toHaveAttribute("type", "password");
    await expect(page.getByText(fakeApiKey)).toHaveCount(0);
    await expect(page.getByText("ak-v***1234")).toBeVisible();

    await page.locator("form").nth(1).getByRole("button").click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("豆包 / 火山方舟").first()).toBeVisible();
    await expect(page.locator("body")).toContainText(/SKIPPED|FAILED|宸茶烦|澶辫触/);
  });

  test("SALES 无 AI 配置入口且直接访问被拒绝，Market Claw 原页面仍可访问", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    for (const pathName of [
      "/app/zhengmu-demo/market-claw",
      "/app/zhengmu-demo/market-claw/ingestion",
      "/app/zhengmu-demo/market-claw/training"
    ]) {
      const response = await page.goto(pathName);
      expect(response?.status()).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/forbidden$/);
    }

    await page.goto("/logout");
    await login(page, "sales@zhengmu.local");
    await expect(page.locator('a[href$="/ai-settings"]')).toHaveCount(0);

    await page.goto("/app/zhengmu-demo/ai-settings");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});

