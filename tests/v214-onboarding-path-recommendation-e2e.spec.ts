/*
 * 文件说明：该文件覆盖 V2.1.4 初始化路径推荐与企业画像适配。
 * 功能说明：通过读取页面、权限、导航和文档文件，验证企业画像、推荐路径、本周动作、准备清单、七步保留和权限边界已接入。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：V2.1.4 初始化向导回归断言
 */
import fs from "fs";
import path from "path";
import { expect, test } from "@playwright/test";

test.describe("V2.1.4 初始化路径推荐与企业画像适配", () => {
  test("初始化向导页面包含企业画像、推荐路径、本周动作和准备清单", async () => {
    const projectRoot = process.cwd();
    const page = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/onboarding/page.tsx"), "utf8");

    expect(page).toContain("企业画像");
    expect(page).toContain("当前阶段");
    expect(page).toContain("推荐初始化路径");
    expect(page).toContain("本周优先动作");
    expect(page).toContain("第一批准备清单");
    expect(page).toContain("七步是完整框架，推荐路径是优先启动路线");
    expect(page).toContain("规则版动态判断，不引入复杂 AI");
    expect(page).toContain("临时预览企业场景");
  });

  test("企业使用场景和推荐初始化路径覆盖通用企业类型", async () => {
    const projectRoot = process.cwd();
    const page = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/onboarding/page.tsx"), "utf8");

    for (const item of ["销售型企业", "渠道型企业", "项目型企业", "服务型企业", "招商型企业", "制造型企业", "咨询交付型企业", "平台会员型企业", "通用企业"]) {
      expect(page).toContain(item);
    }

    for (const item of ["最小启动路径", "客户导入优先路径", "资料投喂优先路径", "销售训练优先路径", "渠道招商路径", "项目服务路径", "平台会员路径", "标准化运营路径"]) {
      expect(page).toContain(item);
    }
  });

  test("原有七步初始化结构继续保留，并说明推荐路径与七步关系", async () => {
    const projectRoot = process.cwd();
    const page = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/onboarding/page.tsx"), "utf8");

    for (const stepId of ["step-1", "step-2", "step-3", "step-4", "step-5", "step-6", "step-7"]) {
      expect(page).toContain(`id="${stepId}"`);
    }

    for (const title of ["企业基础信息", "企业发展阶段判断", "业务线初始化", "客户数据准备", "Market Claw 资料投喂准备", "销售使用准备", "上线检查清单"]) {
      expect(page).toContain(title);
    }

    expect(page).toContain("不同企业不一定第一天完成七步");
    expect(page).toContain("七步初始化继续作为后续补齐和上线检查的完整框架");
  });

  test("权限、文档和通用文案边界保持正确", async () => {
    const projectRoot = process.cwd();
    const auth = fs.readFileSync(path.join(projectRoot, "src/lib/auth.ts"), "utf8");
    const shell = fs.readFileSync(path.join(projectRoot, "src/components/Shell.tsx"), "utf8");
    const onboarding = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/onboarding/page.tsx"), "utf8");
    const marketClaw = fs.readFileSync(path.join(projectRoot, "src/components/MarketClawAssistant.tsx"), "utf8");
    const businessLines = fs.readFileSync(path.join(projectRoot, "src/app/app/[tenantSlug]/business-lines/page.tsx"), "utf8");
    const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
    const agents = fs.readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8");
    const notePath = path.join(projectRoot, "custom/notes/v2.1.4-onboarding-path-recommendation.md");

    expect(fs.existsSync(notePath)).toBeTruthy();
    expect(auth).toContain('return role === "TENANT_ADMIN" || role === "OPERATOR"');
    expect(shell).toContain("初始化向导");
    expect(readme).toContain("## V2.1.4 初始化路径推荐与企业画像适配");
    expect(agents).toContain("custom/notes/v2.1.4-onboarding-path-recommendation.md");
    expect(marketClaw).toContain("Market Claw");
    expect(businessLines).toContain("业务配置");

    expect(onboarding).not.toContain("整木");
    expect(onboarding).not.toContain("乌镇");
    expect(onboarding).not.toContain("CNAS");
  });
});
