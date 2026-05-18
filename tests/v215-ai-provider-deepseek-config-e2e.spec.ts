/*
 * 文件说明：该文件覆盖 V2.1.5 DeepSeek AI Provider 基础配置与安全调用框架。
 * 功能说明：通过读取 schema、迁移、页面、服务、权限和文档文件，验证配置、测试连接、调用日志、安全降级和边界说明已接入。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：V2.1.5 AI Provider 配置能力断言
 */
import fs from "fs";
import path from "path";
import { expect, test } from "@playwright/test";

test.describe("V2.1.5 DeepSeek AI Provider 基础配置", () => {
  test("schema 和迁移包含 AI Provider 配置与调用日志", async () => {
    const projectRoot = process.cwd();
    const schema = fs.readFileSync(path.join(projectRoot, "prisma/schema.prisma"), "utf8");
    const migration = fs.readFileSync(
      path.join(projectRoot, "prisma/migrations/20260518030000_add_ai_provider_config/migration.sql"),
      "utf8"
    );

    expect(schema).toContain("model AiProviderConfig");
    expect(schema).toContain("model AiCallLog");
    expect(schema).toContain("enum AiProvider");
    expect(schema).toContain("DEEPSEEK");
    expect(schema).toContain("OPENAI_COMPATIBLE");
    expect(schema).toContain("MOCK");
    expect(schema).toContain("enum AiCallPurpose");
    expect(migration).toContain("CREATE TABLE \"AiProviderConfig\"");
    expect(migration).toContain("CREATE TABLE \"AiCallLog\"");
  });

  test("AI 配置页覆盖 DeepSeek、OpenAI-compatible、掩码、测试连接和安全边界", async () => {
    const projectRoot = process.cwd();
    const page = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/ai-settings/page.tsx"), "utf8");
    const shell = fs.readFileSync(path.join(projectRoot, "src/components/Shell.tsx"), "utf8");
    const auth = fs.readFileSync(path.join(projectRoot, "src/lib/auth.ts"), "utf8");

    expect(page).toContain("AI 能力配置");
    expect(page).toContain("AI 输出只是建议");
    expect(page).toContain("候选知识仍需人工审核");
    expect(page).toContain("客户回复仍由销售确认");
    expect(page).toContain("DEEPSEEK");
    expect(page).toContain("OPENAI_COMPATIBLE");
    expect(page).toContain("Base URL");
    expect(page).toContain("Model");
    expect(page).toContain("API Key（保存后不完整回显）");
    expect(page).toContain("清空配置并暂停");
    expect(page).toContain("最近调用日志");
    expect(page).toContain("FAILED 或 SKIPPED");
    expect(shell).toContain("AI 能力配置");
    expect(auth).toContain("canAccessTenantAiSettings");
    expect(auth).toContain("canManageTenantAiSettings");
    expect(auth).toContain('return role === "TENANT_ADMIN" || role === "OPERATOR"');
  });

  test("调用服务支持最小文本调用、JSON 调用、调用日志和安全降级", async () => {
    const projectRoot = process.cwd();
    const service = fs.readFileSync(path.join(projectRoot, "src/lib/ai-provider.ts"), "utf8");
    const actions = fs.readFileSync(path.join(projectRoot, "src/lib/actions.ts"), "utf8");

    expect(service).toContain("testAiProviderConnection");
    expect(service).toContain("callAiTextCompletion");
    expect(service).toContain("callAiJsonCompletion");
    expect(service).toContain("recordAiCallLog");
    expect(service).toContain("maskApiKey");
    expect(service).toContain("getChatCompletionsUrl");
    expect(service).toContain("/chat/completions");
    expect(service).toContain("AI Provider 未配置或未启用");
    expect(service).toContain("AI Provider 已启用，但 API Key 未配置");
    expect(service).toContain("promptHash");
    expect(service).not.toContain("console.log(config.apiKey");

    expect(actions).toContain("upsertAiProviderConfig");
    expect(actions).toContain("clearAiProviderConfig");
    expect(actions).toContain("testTenantAiProviderConfig");
    expect(actions).toContain("ai_provider_config_created");
    expect(actions).toContain("ai_provider_config_cleared");
    expect(actions).toContain("ai_provider_config_tested");
  });

  test("文档、记录和原有主链路边界保持正确", async () => {
    const projectRoot = process.cwd();
    const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
    const agents = fs.readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8");
    const marketClaw = fs.readFileSync(path.join(projectRoot, "src/components/MarketClawAssistant.tsx"), "utf8");
    const ingestion = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/market-claw/ingestion/page.tsx"), "utf8");
    const training = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/market-claw/training/page.tsx"), "utf8");
    const notePath = path.join(projectRoot, "custom/notes/v2.1.5-ai-provider-deepseek-config.md");

    expect(fs.existsSync(notePath)).toBeTruthy();
    expect(readme).toContain("## V2.1.5 AI Provider 基础配置与安全调用框架");
    expect(readme).toContain("本轮优先支持 DeepSeek");
    expect(readme).toContain("不直接改 Market Claw 资料投喂、客户详情页回复生成、销售训练或候选知识审核主链路");
    expect(agents).toContain("custom/notes/v2.1.5-ai-provider-deepseek-config.md");
    expect(marketClaw).toContain("Market Claw");
    expect(ingestion).toContain("资料投喂");
    expect(training).toContain("我的训练");
  });
});
