/*
 * 文件说明：该文件覆盖 V2.1.1 售前演示话术与熟客共创试点包的轻量验证。
 * 功能说明：验证 README、专项文档、关键口径和数据库 schema 未改动的约束保持成立。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：V2.1.1 文档交付检查
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { expect, test } from "@playwright/test";

test.describe("V2.1.1 售前演示话术与熟客共创试点包", () => {
  test("README、专项文档和关键口径均已补齐", async () => {
    const projectRoot = process.cwd();
    const requiredFiles = [
      path.join(projectRoot, "custom/docs/sales-one-page-product-brief.md"),
      path.join(projectRoot, "custom/docs/boss-demo-talk-track.md"),
      path.join(projectRoot, "custom/docs/sales-user-quick-guide.md"),
      path.join(projectRoot, "custom/docs/customer-pilot-proposal.md"),
      path.join(projectRoot, "custom/docs/customer-pilot-weekly-report-template.md"),
      path.join(projectRoot, "custom/docs/pricing-and-delivery-boundary.md"),
      path.join(projectRoot, "custom/docs/demo-to-pilot-conversion-script.md"),
      path.join(projectRoot, "custom/notes/v2.1.1-sales-demo-pilot-package.md")
    ];

    for (const filePath of requiredFiles) {
      expect(fs.existsSync(filePath), `${path.relative(projectRoot, filePath)} should exist`).toBeTruthy();
    }

    const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
    expect(readme).toContain("## V2.1.1 售前演示话术与熟客共创试点包");
    expect(readme).toContain("本轮不是系统功能开发");
    expect(readme).toContain("custom/docs/sales-one-page-product-brief.md");

    const brief = fs.readFileSync(requiredFiles[0], "utf8");
    expect(brief).toContain("Market Claw 客户运营增长中台");

    const bossTrack = fs.readFileSync(requiredFiles[1], "utf8");
    expect(bossTrack).toContain("Market Claw 不是普通 CRM，也不是 AI 客服");

    const proposal = fs.readFileSync(requiredFiles[3], "utf8");
    expect(proposal).toContain("30 天启动试点");
    expect(proposal).toContain("90 天共创打磨");

    const weeklyReport = fs.readFileSync(requiredFiles[4], "utf8");
    expect(weeklyReport).toContain("Market Claw 使用情况");

    const pricing = fs.readFileSync(requiredFiles[5], "utf8");
    expect(pricing).toContain("不承诺什么");

    const conversion = fs.readFileSync(requiredFiles[6], "utf8");
    expect(conversion).toContain("30 天试点");
  });

  test("本轮未修改数据库 schema、migration 或 seed", async () => {
    const diffOutput = execSync("git diff --name-only -- prisma/schema.prisma prisma/migrations prisma/seed.ts", {
      cwd: process.cwd(),
      encoding: "utf8"
    }).trim();

    expect(diffOutput).toBe("");
  });
});
