/*
 * 文件说明：该文件覆盖 V2.1.3 企业微信内部工作提醒与成员绑定测试。
 * 功能说明：通过读取 schema、页面、服务和文档文件，验证配置、绑定、日志、权限与安全边界已接入。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：V2.1.3 内部提醒能力断言
 */
import fs from "fs";
import path from "path";
import { expect, test } from "@playwright/test";

test.describe("V2.1.3 企业微信基础提醒与成员绑定测试", () => {
  test("schema 和迁移包含配置扩展、成员绑定与通知日志", async () => {
    const projectRoot = process.cwd();
    const schema = fs.readFileSync(path.join(projectRoot, "prisma/schema.prisma"), "utf8");
    const migration = fs.readFileSync(
      path.join(projectRoot, "prisma/migrations/20260518020000_add_wecom_internal_notification/migration.sql"),
      "utf8"
    );

    expect(schema).toContain("model UserWecomBinding");
    expect(schema).toContain("model WecomNotificationLog");
    expect(schema).toContain("enum WecomNotificationStatus");
    expect(schema).toContain("enum WecomNotificationEventType");
    expect(schema).toContain("lastTestStatus");
    expect(migration).toContain("CREATE TABLE \"UserWecomBinding\"");
    expect(migration).toContain("CREATE TABLE \"WecomNotificationLog\"");
  });

  test("配置页覆盖内部提醒、Secret 掩码、测试提醒、绑定和通知日志", async () => {
    const projectRoot = process.cwd();
    const page = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/wecom/page.tsx"), "utf8");
    const actions = fs.readFileSync(path.join(projectRoot, "src/lib/actions.ts"), "utf8");
    const wecom = fs.readFileSync(path.join(projectRoot, "src/lib/wecom.ts"), "utf8");

    expect(page).toContain("企业微信提醒配置");
    expect(page).toContain("当前仅用于企业内部工作提醒");
    expect(page).toContain("不会回显完整 Secret");
    expect(page).toContain("发送测试提醒");
    expect(page).toContain("成员 ID 绑定");
    expect(page).toContain("最近提醒记录");
    expect(page).toContain("OPERATOR");
    expect(actions).toContain("upsertUserWecomBinding");
    expect(actions).toContain("sendWecomTestNotification");
    expect(actions).toContain("triggerWecomInternalNotification");
    expect(actions).toContain("wecom_config_tested");
    expect(actions).toContain("wecom_user_binding_created");
    expect(wecom).toContain("createWecomInternalNotification");
    expect(wecom).toContain("WecomNotificationStatus.SKIPPED");
    expect(wecom).toContain("当前版本未接入真实企业微信发送 API");
    expect(wecom).not.toContain("customer auto reply");
  });

  test("业务触发点和权限边界已接入，原有链路保持文件存在", async () => {
    const projectRoot = process.cwd();
    const shell = fs.readFileSync(path.join(projectRoot, "src/components/Shell.tsx"), "utf8");
    const auth = fs.readFileSync(path.join(projectRoot, "src/lib/auth.ts"), "utf8");
    const leadPage = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/leads/[id]/page.tsx"), "utf8");
    const todosPage = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/todos/page.tsx"), "utf8");
    const assistant = fs.readFileSync(path.join(projectRoot, "src/components/MarketClawAssistant.tsx"), "utf8");
    const trainingReview = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/market-claw/training/review/page.tsx"), "utf8");
    const ingestion = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/market-claw/ingestion/page.tsx"), "utf8");
    const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
    const notePath = path.join(projectRoot, "custom/notes/v2.1.3-wecom-internal-notification.md");

    expect(fs.existsSync(notePath)).toBeTruthy();
    expect(shell).toContain("企业微信提醒配置");
    expect(auth).toContain('return role === "TENANT_ADMIN" || role === "OPERATOR" || role === "SALES"');
    expect(auth).toContain("canManageTenantWeCom");
    expect(leadPage).toContain("发送客户跟进提醒");
    expect(todosPage).toContain("发送内部提醒");
    expect(assistant).toContain("发送风险边界确认提醒");
    expect(trainingReview).toContain("发送训练待审核提醒");
    expect(ingestion).toContain("发送候选知识待审核提醒");
    expect(readme).toContain("## V2.1.3 企业微信基础提醒与成员绑定测试");
    expect(readme).toContain("只做企业内部工作提醒");
  });
});

