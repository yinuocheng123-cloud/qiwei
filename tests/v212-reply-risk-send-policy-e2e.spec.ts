/*
 * 文件说明：该文件覆盖 V2.1.2 回复风险分级与确认策略的轻量验证。
 * 功能说明：通过读取 schema、页面和核心逻辑文件，确认风险等级、使用模式、页面入口与审计动作均已接入。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：V2.1.2 风险策略断言
 */
import fs from "fs";
import path from "path";
import { expect, test } from "@playwright/test";

test.describe("V2.1.2 回复风险分级与确认策略", () => {
  test("schema、README 和记录文件包含风险等级与使用模式", async () => {
    const projectRoot = process.cwd();
    const schema = fs.readFileSync(path.join(projectRoot, "prisma/schema.prisma"), "utf8");
    const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
    const notePath = path.join(projectRoot, "custom/notes/v2.1.2-reply-risk-send-policy.md");

    expect(fs.existsSync(notePath)).toBeTruthy();
    expect(schema).toContain("enum MarketClawReplyRiskLevel");
    expect(schema).toContain("LOW");
    expect(schema).toContain("MEDIUM");
    expect(schema).toContain("HIGH");
    expect(schema).toContain("BLOCKED");
    expect(schema).toContain("enum MarketClawSendMode");
    expect(schema).toContain("AUTO_ALLOWED");
    expect(schema).toContain("SALES_CONFIRM_REQUIRED");
    expect(schema).toContain("RISK_CONFIRM_REQUIRED");
    expect(schema).not.toContain("MANAGER_REVIEW_REQUIRED");
    expect(schema).toContain("INTERNAL_ADVICE_ONLY");
    expect(readme).toContain("## V2.1.2 回复风险分级与确认策略");
    expect(readme).toContain("本轮不接入企业微信");
  });

  test("核心逻辑覆盖候选知识、客户详情回复、训练和审计动作", async () => {
    const projectRoot = process.cwd();
    const marketClaw = fs.readFileSync(path.join(projectRoot, "src/lib/market-claw.ts"), "utf8");
    const actions = fs.readFileSync(path.join(projectRoot, "src/lib/actions.ts"), "utf8");
    const assistant = fs.readFileSync(path.join(projectRoot, "src/components/MarketClawAssistant.tsx"), "utf8");

    expect(marketClaw).toContain("inferMarketClawPolicy");
    expect(marketClaw).toContain("buildMarketClawReplyPolicy");
    expect(marketClaw).toContain("suggestedReplyRiskLevel");
    expect(marketClaw).toContain("风险边界确认");
    expect(marketClaw).toContain('RISK_CONFIRM_REQUIRED: "风险边界确认后使用"');
    expect(marketClaw).not.toContain("MANAGER_REVIEW_REQUIRED");
    expect(actions).toContain("market_claw_reply_risk_level_assigned");
    expect(actions).toContain("market_claw_send_mode_updated");
    expect(actions).toContain("market_claw_high_risk_reply_submitted");
    expect(actions).toContain("market_claw_internal_advice_created");
    expect(actions).toContain("market_claw_blocked_reply_detected");
    expect(assistant).toContain("仅内部建议");
    expect(assistant).toContain("销售确认后使用 / 提交优化");
    expect(assistant).toContain("查看边界提醒");
    expect(assistant).toContain("确认条件后使用");
    expect(assistant).toContain("创建负责人任务");
    expect(assistant).toContain('isBlocked ? "仅内部建议" : isHighRisk ? "确认条件后使用');
    expect(assistant).not.toContain("提交上级审核");
    expect(assistant).not.toContain("必须主管批准");
  });

  test("知识库、资料投喂、训练审核和回复记录页面展示风险策略", async () => {
    const projectRoot = process.cwd();
    const files = [
      "src/app/app/[tenantSlug]/market-claw/knowledge/page.tsx",
      "src/app/app/[tenantSlug]/market-claw/ingestion/page.tsx",
      "src/app/app/[tenantSlug]/market-claw/training/page.tsx",
      "src/app/app/[tenantSlug]/market-claw/training/review/page.tsx",
      "src/app/app/[tenantSlug]/market-claw/replies/page.tsx"
    ];

    for (const relativePath of files) {
      const content = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
      expect(content, relativePath).toContain("marketClawReplyRiskLevel");
      expect(content, relativePath).toContain("marketClawSendMode");
    }

    const repliesPage = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/market-claw/replies/page.tsx"), "utf8");
    expect(repliesPage).toContain("是否命中高风险知识");
    expect(repliesPage).toContain("是否来自个人话术");
  });
});
