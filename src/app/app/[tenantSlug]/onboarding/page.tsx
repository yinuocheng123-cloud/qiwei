/*
 * 文件说明：该页面实现 V2.0.9 企业开通与初始化向导，并在 V2.1.4 增加初始化路径推荐。
 * 功能说明：帮助新企业先判断企业画像、阶段和推荐启动路线，再按七个步骤完成基础配置、业务线、客户、资料投喂、销售使用准备和上线检查。
 *
 * 结构概览：
 *   第一部分：导入依赖与静态配置
 *   第二部分：步骤判断与展示辅助函数
 *   第三部分：初始化向导页面
 */
import Link from "next/link";
import { PageShell } from "@/components/Shell";
import { Callout, Card, StatCard } from "@/components/Ui";
import { canAccessTenantOnboarding, requireTenantAccess } from "@/lib/auth";
import { getMarketClawTrainingInsights } from "@/lib/market-claw";
import { labelOf, sourceOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const initializationPaths = {
  foundation: "基础配置路径",
  importAndIngestion: "客户导入 + 资料投喂路径",
  ingestionAndTraining: "资料投喂 + 销售训练路径",
  standardization: "标准化治理路径",
  mature: "成熟运营优化路径"
} as const;

type InitializationPath = (typeof initializationPaths)[keyof typeof initializationPaths];

type OnboardingSnapshot = {
  tenantName: string;
  industry: string | null;
  activeBusinessLineCount: number;
  businessLineNames: string[];
  leadCount: number;
  importBatchCount: number;
  recentImportBatchCount: number;
  sourceAttributionCount: number;
  activeSalesCount: number;
  salesWithLeadsCount: number;
  recentMarketClawUsageCount: number;
  salesTrainingSampleCount: number;
  ingestionBatchCount: number;
  candidateCount: number;
  adoptedKnowledgeCount: number;
  enterpriseKnowledgeCount: number;
  teamKnowledgeCount: number;
  businessLineKnowledgeCount: number;
  faqCount: number;
  productIntroCount: number;
  salesScriptCount: number;
  priceBoundaryCount: number;
  riskBoundaryCount: number;
  materialsCount: number;
  sourceLabels: string[];
  maturityStage: string | null;
  maturityRationale: string[];
  knowledgeGaps: string[];
};

type StageAssessment = {
  stage: "初始阶段" | "启动阶段" | "成长期" | "标准化阶段" | "成熟运营阶段";
  path: InitializationPath;
  rationale: string[];
  nextActions: string[];
};

const businessScenarios = {
  SALES_DRIVEN: {
    label: "销售型企业",
    description: "重点是客户、销售、跟进任务。"
  },
  CHANNEL_DRIVEN: {
    label: "渠道型企业",
    description: "重点是渠道客户、合作政策、合作资料、跟进节奏。"
  },
  PROJECT_DRIVEN: {
    label: "项目型企业",
    description: "重点是项目阶段、需求判断、方案推进、关键节点。"
  },
  SERVICE_DRIVEN: {
    label: "服务型企业",
    description: "重点是服务流程、FAQ、交付边界、售后说明。"
  },
  INVESTMENT_DRIVEN: {
    label: "招商型企业",
    description: "重点是政策、案例、异议处理、价格边界。"
  },
  MANUFACTURING_DRIVEN: {
    label: "制造型企业",
    description: "重点是产品资料、供应能力、交付流程、质量边界。"
  },
  CONSULTING_DELIVERY: {
    label: "咨询交付型企业",
    description: "重点是需求诊断、方案说明、案例、交付流程。"
  },
  PLATFORM_MEMBERSHIP: {
    label: "平台会员型企业",
    description: "重点是会员权益、资源说明、转化话术、服务边界。"
  },
  GENERAL: {
    label: "通用企业",
    description: "适合尚未明确分类的企业，默认走最小启动路径。"
  }
} as const;

const recommendedPaths = {
  MINIMUM_START: {
    label: "最小启动路径",
    description: "先做 1 条业务线、20 个客户、1 份资料、10 个 FAQ、1 名销售试用。"
  },
  CUSTOMER_IMPORT_FIRST: {
    label: "客户导入优先路径",
    description: "先导入客户、分配负责人、建立跟进任务，再补资料和话术。"
  },
  KNOWLEDGE_INGESTION_FIRST: {
    label: "资料投喂优先路径",
    description: "先投喂资料、生成候选知识、审核入库，再给销售使用。"
  },
  SALES_TRAINING_FIRST: {
    label: "销售训练优先路径",
    description: "先开通销售、建立客户跟进、提交训练，再沉淀标准话术。"
  },
  CHANNEL_PARTNER_PATH: {
    label: "渠道招商路径",
    description: "重点配置招商政策、合作条件、案例、异议处理和价格边界。"
  },
  PROJECT_SERVICE_PATH: {
    label: "项目服务路径",
    description: "重点配置项目阶段、需求判断、方案说明、交付流程和服务边界。"
  },
  PLATFORM_MEMBERSHIP_PATH: {
    label: "平台会员路径",
    description: "重点配置会员权益、资源说明、服务边界和转化话术。"
  },
  STANDARDIZATION_PATH: {
    label: "标准化运营路径",
    description: "重点做知识去重、风险边界、训练复盘和标准化运营。"
  }
} as const;

type BusinessScenario = keyof typeof businessScenarios;
type RecommendedPath = keyof typeof recommendedPaths;

type OnboardingProfile = {
  businessScenario: BusinessScenario;
  onboardingStage: StageAssessment["stage"];
  recommendedPath: RecommendedPath;
  rationale: string[];
  missingItems: string[];
  weeklyActions: string[];
  preparationChecklist: string[];
  readinessExplanation: string;
};

type ChecklistItem = {
  title: string;
  done: boolean;
  currentValue: string;
  action: string;
  href: string;
};

function yesNo(value: boolean) {
  return value ? "是" : "否";
}

function statusText(done: boolean, warning = false) {
  if (done) return { label: "已具备基础", className: "bg-emerald-50 text-emerald-700" };
  if (warning) return { label: "建议优先完成", className: "bg-amber-50 text-amber-700" };
  return { label: "可继续补齐", className: "bg-slate-100 text-slate-700" };
}

function checklistReadiness(items: ChecklistItem[]) {
  const doneCount = items.filter((item) => item.done).length;
  if (doneCount <= 3) return "未准备好";
  if (doneCount <= 6) return "基本可试用";
  if (doneCount <= 8) return "适合小范围试运行";
  return "适合正式内部使用";
}

function normalizeBusinessScenario(value?: string): BusinessScenario {
  if (value && value in businessScenarios) {
    return value as BusinessScenario;
  }
  return "GENERAL";
}

function pathFromScenario(scenario: BusinessScenario): RecommendedPath | null {
  if (scenario === "CHANNEL_DRIVEN" || scenario === "INVESTMENT_DRIVEN") return "CHANNEL_PARTNER_PATH";
  if (scenario === "PROJECT_DRIVEN" || scenario === "SERVICE_DRIVEN" || scenario === "CONSULTING_DELIVERY") return "PROJECT_SERVICE_PATH";
  if (scenario === "PLATFORM_MEMBERSHIP") return "PLATFORM_MEMBERSHIP_PATH";
  return null;
}

function recommendPath(snapshot: OnboardingSnapshot, scenario: BusinessScenario): RecommendedPath {
  const scenarioPath = pathFromScenario(scenario);
  if (scenarioPath) return scenarioPath;

  if (snapshot.activeBusinessLineCount === 0 || snapshot.leadCount < 20) return "MINIMUM_START";
  if (snapshot.leadCount >= 50 && snapshot.ingestionBatchCount === 0) return "CUSTOMER_IMPORT_FIRST";
  if (snapshot.ingestionBatchCount > 0 && snapshot.adoptedKnowledgeCount < 5) return "KNOWLEDGE_INGESTION_FIRST";
  if (snapshot.activeSalesCount >= 2 && snapshot.salesTrainingSampleCount < 3) return "SALES_TRAINING_FIRST";
  if (snapshot.salesScriptCount >= 6 && snapshot.teamKnowledgeCount < 4) return "STANDARDIZATION_PATH";
  if (snapshot.candidateCount >= 8 && snapshot.riskBoundaryCount + snapshot.priceBoundaryCount < 3) return "STANDARDIZATION_PATH";
  if (snapshot.ingestionBatchCount === 0) return "KNOWLEDGE_INGESTION_FIRST";
  return "STANDARDIZATION_PATH";
}

function buildMissingItems(snapshot: OnboardingSnapshot) {
  const missingItems = [
    snapshot.activeBusinessLineCount < 1 ? "第一条核心业务线" : null,
    snapshot.leadCount < 20 ? "第一批有效客户" : null,
    snapshot.ingestionBatchCount < 1 ? "第一份企业资料" : null,
    snapshot.faqCount < 10 ? "第一批常见问题" : null,
    snapshot.activeSalesCount < 1 ? "第一名试用销售" : null,
    snapshot.riskBoundaryCount + snapshot.priceBoundaryCount < 3 ? "第一批价格边界与风险边界" : null,
    snapshot.salesTrainingSampleCount < 1 ? "第一条销售训练样本" : null
  ].filter(Boolean);

  return missingItems.length ? (missingItems as string[]) : ["当前基础内容较完整，建议进入知识治理与训练复盘。"];
}

function weeklyActionsForPath(path: RecommendedPath) {
  const actions: Record<RecommendedPath, string[]> = {
    MINIMUM_START: ["建立 1 条核心业务线。", "导入 20 个有效客户。", "投喂 1 份企业介绍或产品说明。", "生成 10 条基础 FAQ。", "安排 1 名销售完成一次客户回复测试。"],
    CUSTOMER_IMPORT_FIRST: ["整理第一批客户名单。", "导入 50～100 个有效客户。", "分配负责人。", "建立跟进任务。", "用 Market Claw 测试 3 个真实客户问题。"],
    KNOWLEDGE_INGESTION_FIRST: ["准备企业介绍、产品说明、百问百答。", "投喂 1～3 份核心资料。", "生成候选知识。", "采纳 5～10 条标准知识。", "补齐价格边界和风险提醒。"],
    SALES_TRAINING_FIRST: ["开通销售账号。", "分配客户。", "让销售在客户详情页生成回复。", "保存个人话术。", "提交 1 条训练给管理员审核。"],
    CHANNEL_PARTNER_PATH: ["整理合作政策和合作条件。", "准备第一批合作案例。", "补齐价格边界和常见异议。", "导入渠道或招商线索。", "安排销售测试 3 个合作咨询问题。"],
    PROJECT_SERVICE_PATH: ["整理项目阶段和需求判断问题。", "准备方案说明和交付流程。", "补齐服务边界。", "导入第一批项目客户。", "用 Market Claw 测试项目推进话术。"],
    PLATFORM_MEMBERSHIP_PATH: ["梳理会员权益和资源说明。", "准备服务边界和续费说明。", "整理转化话术。", "导入第一批会员或意向客户。", "测试权益说明与异议处理回复。"],
    STANDARDIZATION_PATH: ["查看训练复盘。", "整理高频问题。", "合并重复知识。", "补齐风险边界。", "将优秀个人话术升级为团队标准。"]
  };
  return actions[path];
}

function preparationChecklistForPath(path: RecommendedPath) {
  const baseItems = ["第一批客户", "第一批业务线", "第一批企业资料", "第一批常见问题", "第一批销售人员", "第一批风险边界", "第一批案例", "第一批跟进任务"];
  const pathItems: Partial<Record<RecommendedPath, string[]>> = {
    CHANNEL_PARTNER_PATH: ["招商政策", "合作条件", "合作案例", "异议处理", "价格边界"],
    PROJECT_SERVICE_PATH: ["项目阶段", "需求判断问题", "方案说明", "交付流程", "服务边界"],
    PLATFORM_MEMBERSHIP_PATH: ["会员权益", "资源说明", "服务边界", "转化话术", "续费说明"]
  };
  return [...(pathItems[path] ?? []), ...baseItems].slice(0, 10);
}

function readinessExplanationForPath(path: RecommendedPath) {
  if (path === "MINIMUM_START") return "建议先不要追求完整配置，先完成 1 条业务线、20 个客户、1 份资料、1 名销售试用。";
  if (path === "KNOWLEDGE_INGESTION_FIRST") return "当前资料准备是关键，建议先把企业介绍、产品说明、百问百答投喂并完成第一批候选知识审核。";
  if (path === "CUSTOMER_IMPORT_FIRST") return "当前客户数据是关键，建议先导入有效客户、分配负责人并建立跟进任务。";
  if (path === "SALES_TRAINING_FIRST") return "当前销售使用是关键，建议让销售在真实客户场景中生成回复、保存话术并提交训练。";
  return "当前更适合围绕知识、话术、风险边界和训练复盘做标准化运营。";
}

function buildOnboardingProfile(snapshot: OnboardingSnapshot, scenario: BusinessScenario, stageAssessment: StageAssessment): OnboardingProfile {
  const recommendedPath = recommendPath(snapshot, scenario);
  return {
    businessScenario: scenario,
    onboardingStage: stageAssessment.stage,
    recommendedPath,
    rationale: [
      `当前业务线 ${snapshot.activeBusinessLineCount} 条，客户 ${snapshot.leadCount} 个。`,
      `资料投喂 ${snapshot.ingestionBatchCount} 批，已采纳知识 ${snapshot.adoptedKnowledgeCount} 条。`,
      `销售用户 ${snapshot.activeSalesCount} 名，训练样本 ${snapshot.salesTrainingSampleCount} 条。`,
      `当前选择的企业使用场景是：${businessScenarios[scenario].label}。`
    ],
    missingItems: buildMissingItems(snapshot),
    weeklyActions: weeklyActionsForPath(recommendedPath),
    preparationChecklist: preparationChecklistForPath(recommendedPath),
    readinessExplanation: readinessExplanationForPath(recommendedPath)
  };
}

function buildStageAssessment(snapshot: OnboardingSnapshot): StageAssessment {
  const rationale = [
    `当前业务线 ${snapshot.activeBusinessLineCount} 条，客户 ${snapshot.leadCount} 个。`,
    `资料投喂 ${snapshot.ingestionBatchCount} 批，候选知识 ${snapshot.candidateCount} 条。`,
    `训练样本 ${snapshot.salesTrainingSampleCount} 条，最近 Market Claw 使用 ${snapshot.recentMarketClawUsageCount} 次。`
  ];

  if (
    snapshot.enterpriseKnowledgeCount + snapshot.teamKnowledgeCount + snapshot.businessLineKnowledgeCount >= 24 &&
    snapshot.recentMarketClawUsageCount >= 10 &&
    snapshot.salesTrainingSampleCount >= 12
  ) {
    return {
      stage: "成熟运营阶段",
      path: initializationPaths.mature,
      rationale: [...rationale, "标准知识、使用记录和训练样本都比较稳定。"],
      nextActions: ["按月做知识治理。", "复盘高价值话术与业务线质量。", "建立复审节奏和优秀实践沉淀。"]
    };
  }

  if (
    snapshot.enterpriseKnowledgeCount >= 8 &&
    snapshot.teamKnowledgeCount + snapshot.businessLineKnowledgeCount >= 8 &&
    snapshot.salesTrainingSampleCount >= 6 &&
    snapshot.recentMarketClawUsageCount >= 4
  ) {
    return {
      stage: "标准化阶段",
      path: initializationPaths.standardization,
      rationale: [...rationale, "正式知识、训练审核和销售使用已经形成基本闭环。"],
      nextActions: ["优先做知识缺口治理。", "复盘风险边界与标准回复的一致性。", "推动优秀销售话术升级为团队标准。"]
    };
  }

  if (
    snapshot.ingestionBatchCount > 0 &&
    snapshot.candidateCount > 0 &&
    (snapshot.salesTrainingSampleCount >= 3 || snapshot.recentMarketClawUsageCount >= 3)
  ) {
    return {
      stage: "成长期",
      path: initializationPaths.ingestionAndTraining,
      rationale: [...rationale, "已经开始资料投喂和销售使用，但还需要继续收口高频问题与知识边界。"],
      nextActions: ["继续做资料投喂。", "让销售把真实客户问题带进“我的训练”。", "优先补齐 FAQ、价格边界和风险提醒。"]
    };
  }

  if ((snapshot.leadCount > 0 || snapshot.importBatchCount > 0) && snapshot.ingestionBatchCount === 0) {
    return {
      stage: "启动阶段",
      path: initializationPaths.importAndIngestion,
      rationale: [...rationale, "已有客户基础，但知识和资料投喂还没有真正跑起来。"],
      nextActions: ["先导入 20～100 个有效客户。", "准备企业介绍、产品介绍、FAQ 和价格边界。", "完成第一批资料投喂后再组织销售试用。"]
    };
  }

  return {
    stage: "初始阶段",
    path: initializationPaths.foundation,
    rationale: [...rationale, "当前更适合先完成最小基础配置，而不是直接追求复杂训练与治理。"],
    nextActions: ["先配置 1～3 条核心业务线。", "先导入一批有效客户。", "先准备产品介绍、FAQ、价格边界和不能承诺事项。"]
  };
}

function buildChecklist(snapshot: OnboardingSnapshot): ChecklistItem[] {
  return [
    {
      title: "已创建至少 1 条业务线",
      done: snapshot.activeBusinessLineCount >= 1,
      currentValue: `${snapshot.activeBusinessLineCount} 条`,
      action: "先把核心业务线配置起来。",
      href: "business-lines"
    },
    {
      title: "已导入至少 20 个客户",
      done: snapshot.leadCount >= 20,
      currentValue: `${snapshot.leadCount} 个客户`,
      action: "先导入一批有效客户做试运行。",
      href: "imports"
    },
    {
      title: "已设置客户负责人",
      done: snapshot.salesWithLeadsCount >= 1,
      currentValue: `${snapshot.salesWithLeadsCount} 名销售已有负责客户`,
      action: "确保导入客户后明确负责人。",
      href: "leads"
    },
    {
      title: "已投喂至少 1 份企业资料",
      done: snapshot.ingestionBatchCount >= 1,
      currentValue: `${snapshot.ingestionBatchCount} 批资料投喂`,
      action: "先投喂企业介绍、产品介绍或 FAQ。",
      href: "market-claw/ingestion"
    },
    {
      title: "已采纳至少 5 条知识",
      done: snapshot.adoptedKnowledgeCount >= 5,
      currentValue: `${snapshot.adoptedKnowledgeCount} 条`,
      action: "优先把最常用的候选知识采纳入库。",
      href: "market-claw/knowledge"
    },
    {
      title: "已设置至少 3 条风险边界或不建议承诺事项",
      done: snapshot.riskBoundaryCount + snapshot.priceBoundaryCount >= 3,
      currentValue: `${snapshot.riskBoundaryCount + snapshot.priceBoundaryCount} 条`,
      action: "先补价格边界、效果边界和不能承诺事项。",
      href: "market-claw/knowledge"
    },
    {
      title: "至少 1 名销售完成一次 Market Claw 回复",
      done: snapshot.recentMarketClawUsageCount >= 1,
      currentValue: `${snapshot.recentMarketClawUsageCount} 次最近使用`,
      action: "让销售先拿真实客户跑一轮回复。",
      href: "market-claw"
    },
    {
      title: "至少 1 条销售训练提交审核",
      done: snapshot.salesTrainingSampleCount >= 1,
      currentValue: `${snapshot.salesTrainingSampleCount} 条训练样本`,
      action: "引导销售把真实问题提交为训练样本。",
      href: "market-claw/training"
    },
    {
      title: "管理员完成一次采纳或驳回",
      done: snapshot.adoptedKnowledgeCount >= 1 || snapshot.candidateCount >= 1,
      currentValue: `候选 ${snapshot.candidateCount} / 采纳 ${snapshot.adoptedKnowledgeCount}`,
      action: "先跑通一次候选审核动作。",
      href: "market-claw/ingestion"
    },
    {
      title: "训练复盘页有基础数据",
      done: snapshot.salesTrainingSampleCount >= 1 || snapshot.candidateCount >= 1 || snapshot.recentMarketClawUsageCount >= 1,
      currentValue: `训练 ${snapshot.salesTrainingSampleCount} / 候选 ${snapshot.candidateCount} / 使用 ${snapshot.recentMarketClawUsageCount}`,
      action: "先让训练、资料投喂或回复使用至少跑通一条。",
      href: "market-claw/insights"
    }
  ];
}

function StepHeader({
  step,
  title,
  done,
  warning = false
}: {
  step: string;
  title: string;
  done: boolean;
  warning?: boolean;
}) {
  const status = statusText(done, warning);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{step}</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">{title}</h2>
      </div>
      <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
    </div>
  );
}

function ActionRow({
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  skipHref
}: {
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  skipHref: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <Link className="inline-flex rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white" href={primaryHref}>
        {primaryLabel}
      </Link>
      {secondaryHref && secondaryLabel ? (
        <Link className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" href={secondaryHref}>
          {secondaryLabel}
        </Link>
      ) : null}
      <a className="inline-flex rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600" href={skipHref}>
        先跳过，继续下一步
      </a>
    </div>
  );
}

export default async function TenantOnboardingPage({ params, searchParams }: { params: { tenantSlug: string }; searchParams?: { businessScenario?: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canAccessTenantOnboarding(user.role)) {
    return null;
  }

  const [leadCount, leadsBySource, activeBusinessLines, importBatchCount, recentImportBatchCount, sourceAttributionCount, salesUsers, salesLeadGroups, materialsCount, knowledgeStats, recentMarketClawUsageCount, salesTrainingSampleCount, insights] =
    await Promise.all([
      prisma.lead.count({ where: { tenantId: tenant.id } }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { tenantId: tenant.id },
        _count: true,
        orderBy: { _count: { source: "desc" } },
        take: 3
      }),
      prisma.businessLine.findMany({
        where: { tenantId: tenant.id, status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
      }),
      prisma.importBatch.count({ where: { tenantId: tenant.id } }),
      prisma.importBatch.count({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.leadSourceAttribution.count({ where: { tenantId: tenant.id } }),
      prisma.user.findMany({
        where: { tenantId: tenant.id, status: "active", role: "SALES" },
        select: { id: true, name: true }
      }),
      prisma.lead.groupBy({
        by: ["ownerId"],
        where: { tenantId: tenant.id, ownerId: { not: null } },
        _count: true
      }),
      prisma.material.count({ where: { tenantId: tenant.id } }),
      prisma.marketClawKnowledgeItem.findMany({
        where: { tenantId: tenant.id, status: "ACTIVE", reviewStatus: "APPROVED" },
        select: { scopeLevel: true, knowledgeType: true }
      }),
      prisma.marketClawReplyDraft.count({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.marketClawTrainingCase.count({
        where: {
          tenantId: tenant.id,
          createdBy: { role: "SALES" }
        }
      }),
      getMarketClawTrainingInsights({
        tenantId: tenant.id,
        role: user.role,
        userId: user.id
      })
    ]);

  const salesUserIds = new Set(salesUsers.map((item) => item.id));
  const salesWithLeadsCount = salesLeadGroups.filter((item) => item.ownerId && salesUserIds.has(item.ownerId)).length;
  const sourceLabels = leadsBySource.map((item) => labelOf(sourceOptions, item.source));
  const enterpriseKnowledgeCount = knowledgeStats.filter((item) => item.scopeLevel === "ENTERPRISE").length;
  const teamKnowledgeCount = knowledgeStats.filter((item) => item.scopeLevel === "DEPARTMENT").length;
  const businessLineKnowledgeCount = knowledgeStats.filter((item) => item.scopeLevel === "BUSINESS_LINE").length;
  const totalKnowledgeCount = enterpriseKnowledgeCount + teamKnowledgeCount + businessLineKnowledgeCount;
  const faqCount = knowledgeStats.filter((item) => item.knowledgeType === "FAQ").length;
  const productIntroCount = knowledgeStats.filter((item) => item.knowledgeType === "SERVICE_INTRO").length;
  const salesScriptCount = knowledgeStats.filter((item) => item.knowledgeType === "SALES_SCRIPT" || item.knowledgeType === "STANDARD_REPLY").length;
  const priceBoundaryCount = knowledgeStats.filter((item) => item.knowledgeType === "PRICE_BOUNDARY").length;
  const riskBoundaryCount = knowledgeStats.filter((item) => item.knowledgeType === "FORBIDDEN_COMMITMENT" || item.knowledgeType === "RISK_NOTICE").length;

  const snapshot: OnboardingSnapshot = {
    tenantName: tenant.name,
    industry: tenant.industry ?? null,
    activeBusinessLineCount: activeBusinessLines.length,
    businessLineNames: activeBusinessLines.map((item) => item.name).slice(0, 3),
    leadCount,
    importBatchCount,
    recentImportBatchCount,
    sourceAttributionCount,
    activeSalesCount: salesUsers.length,
    salesWithLeadsCount,
    recentMarketClawUsageCount,
    salesTrainingSampleCount,
    ingestionBatchCount: insights.summaryMetrics.ingestionBatchCount,
    candidateCount: insights.summaryMetrics.candidateCount,
    adoptedKnowledgeCount: totalKnowledgeCount,
    enterpriseKnowledgeCount,
    teamKnowledgeCount,
    businessLineKnowledgeCount,
    faqCount,
    productIntroCount,
    salesScriptCount,
    priceBoundaryCount,
    riskBoundaryCount,
    materialsCount,
    sourceLabels,
    maturityStage: insights.maturityStage?.stage ?? null,
    maturityRationale: insights.maturityStage?.rationale ?? [],
    knowledgeGaps: insights.knowledgeGaps.slice(0, 4).map((item) => `${item.businessLine}：${item.gapType}`)
  };

  const stageAssessment = buildStageAssessment(snapshot);
  const selectedScenario = normalizeBusinessScenario(searchParams?.businessScenario);
  const onboardingProfile = buildOnboardingProfile(snapshot, selectedScenario, stageAssessment);
  const checklist = buildChecklist(snapshot);
  const readiness = checklistReadiness(checklist);
  const base = `/app/${tenant.slug}`;
  return (
    <PageShell
      tenant={tenant}
      title="初始化向导"
      breadcrumbs={[
        { label: "首页", href: `${base}/dashboard` },
        { label: "初始化向导" }
      ]}
      description="这不是给老用户日常使用的页面，而是给新企业第一次启用系统时的七步引导。目标是先把最小基础跑起来，再逐步进入资料投喂、销售训练和知识治理。"
    >
      <Callout title="本轮意图摘要" tone="amber">
        初始化向导不是让企业把系统配置满，而是帮企业用最小动作先跑起来。系统会先判断企业画像和当前阶段，再推荐本周优先启动路线，最后仍保留七步完整初始化框架。
      </Callout>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="当前建议阶段" value={stageAssessment.stage} />
        <StatCard label="推荐初始化路径" value={recommendedPaths[onboardingProfile.recommendedPath].label} />
        <StatCard label="启用业务线" value={snapshot.activeBusinessLineCount} />
        <StatCard label="客户数量" value={snapshot.leadCount} />
        <StatCard label="上线准备度" value={readiness} />
      </div>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">企业画像</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {businessScenarios[onboardingProfile.businessScenario].label} · {onboardingProfile.onboardingStage}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{businessScenarios[onboardingProfile.businessScenario].description}</p>
            </div>
            <form className="flex flex-wrap items-end gap-2" method="get">
              <label className="text-sm font-medium text-slate-700">
                临时预览企业场景
                <select
                  className="mt-2 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  name="businessScenario"
                  defaultValue={onboardingProfile.businessScenario}
                >
                  {Object.entries(businessScenarios).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white" type="submit">
                预览路径
              </button>
            </form>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <InfoCard label="当前阶段" value={onboardingProfile.onboardingStage} />
            <InfoCard label="推荐初始化路径" value={recommendedPaths[onboardingProfile.recommendedPath].label} />
            <InfoCard label="路径说明" value={recommendedPaths[onboardingProfile.recommendedPath].description} />
            <InfoCard label="当前最缺内容" value={onboardingProfile.missingItems.join("、")} />
            <InfoCard label="上线准备度解释" value={onboardingProfile.readinessExplanation} />
            <InfoCard label="判断方式" value="规则版动态判断，不引入复杂 AI，不新增初始化画像表。" />
          </div>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">判断依据</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {onboardingProfile.rationale.map((item) => (
                <p key={item}>- {item}</p>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">启动路线说明</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">七步是完整框架，推荐路径是优先启动路线</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            不同企业不一定第一天完成七步。推荐路径只回答“本周先做什么最值”，七步初始化继续作为后续补齐和上线检查的完整框架。
          </p>
          <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
            <p>- 低数据量企业优先跑最小启动。</p>
            <p>- 客户较多企业优先整理客户和负责人。</p>
            <p>- 资料较多企业优先资料投喂和候选审核。</p>
            <p>- 已经开始使用的企业优先训练复盘和标准化。</p>
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">本周优先动作</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">{recommendedPaths[onboardingProfile.recommendedPath].label}</h2>
          <div className="mt-4 space-y-3">
            {onboardingProfile.weeklyActions.map((item, index) => (
              <div key={item} className="rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                <span className="mr-2 font-semibold text-emerald-700">{index + 1}.</span>
                {item}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">第一批准备清单</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">先准备能跑通闭环的内容</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {onboardingProfile.preparationChecklist.map((item) => (
              <p key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {item}
              </p>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <div className="grid gap-4 xl:grid-cols-4">
          {[
            { anchor: "step-1", label: "步骤一", title: "企业基础信息", done: Boolean(snapshot.tenantName && (snapshot.industry || snapshot.activeBusinessLineCount || snapshot.leadCount)) },
            { anchor: "step-2", label: "步骤二", title: "企业发展阶段判断", done: true },
            { anchor: "step-3", label: "步骤三", title: "业务线初始化", done: snapshot.activeBusinessLineCount >= 1 },
            { anchor: "step-4", label: "步骤四", title: "客户数据准备", done: snapshot.leadCount >= 1 || snapshot.importBatchCount >= 1 },
            { anchor: "step-5", label: "步骤五", title: "Market Claw 资料投喂准备", done: snapshot.ingestionBatchCount >= 1 || snapshot.materialsCount >= 1 },
            { anchor: "step-6", label: "步骤六", title: "销售使用准备", done: snapshot.activeSalesCount >= 1 && snapshot.salesWithLeadsCount >= 1 },
            { anchor: "step-7", label: "步骤七", title: "上线检查清单", done: checklist.filter((item) => item.done).length >= 4 }
          ].map((item) => (
            <a key={item.anchor} href={`#${item.anchor}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{item.label}</p>
              <h2 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm text-slate-600">{item.done ? "当前已具备基础" : "建议优先补齐"}</p>
            </a>
          ))}
        </div>
      </section>

      <div className="mt-8 space-y-6">
        <section id="step-1">
          <Card>
          <StepHeader step="步骤一" title="企业基础信息" done={Boolean(snapshot.tenantName && (snapshot.industry || snapshot.activeBusinessLineCount || snapshot.leadCount))} warning />
          <p className="mt-3 text-sm leading-6 text-slate-600">
            这一步先看企业现在已经具备哪些基础，不强求一次性补齐全部资料。没有结构化记录的内容，先按现有系统数据做动态判断。
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <InfoCard label="企业名称" value={snapshot.tenantName} />
            <InfoCard label="行业类型" value={snapshot.industry ?? "当前未填写"} />
            <InfoCard label="当前主要业务" value={snapshot.businessLineNames.length ? snapshot.businessLineNames.join("、") : "当前还没有启用业务线"} />
            <InfoCard label="当前销售人数" value={`${snapshot.activeSalesCount} 人`} />
            <InfoCard label="当前客户来源" value={snapshot.sourceLabels.length ? snapshot.sourceLabels.join("、") : "当前还没有结构化来源数据"} />
            <InfoCard label="当前是否已有客户资料" value={yesNo(snapshot.materialsCount > 0 || snapshot.leadCount > 0)} />
            <InfoCard label="当前是否已有产品介绍" value={yesNo(snapshot.productIntroCount > 0)} />
            <InfoCard label="当前是否已有百问百答" value={yesNo(snapshot.faqCount > 0)} />
            <InfoCard label="当前是否已有销售话术" value={yesNo(snapshot.salesScriptCount > 0)} />
            <InfoCard label="当前是否已有价格边界" value={yesNo(snapshot.priceBoundaryCount > 0)} />
            <InfoCard label="当前是否已有不能承诺事项" value={yesNo(snapshot.riskBoundaryCount > 0)} />
          </div>
          <RiskBlock
            risk="如果企业第一天连业务线、客户、资料都还没准备好，就不建议急着让销售直接重度使用 Market Claw。"
            next="先补最小基础，再让销售从真实客户场景开始试跑。"
          />
          <ActionRow primaryHref={`${base}/dashboard`} primaryLabel="回到首页看整体情况" skipHref="#step-2" />
          </Card>
        </section>

        <section id="step-2">
          <Card>
          <StepHeader step="步骤二" title="企业发展阶段判断" done warning={false} />
          <p className="mt-3 text-sm leading-6 text-slate-600">
            这里复用了 V2.0.8 的轻量治理思路，但场景切换成“新企业怎么开始”。目标不是给企业贴标签，而是判断现在最适合走哪条初始化路径。
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">当前建议阶段</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{stageAssessment.stage}</h2>
            <p className="mt-2 text-sm text-emerald-700">推荐初始化路径：{recommendedPaths[onboardingProfile.recommendedPath].label}</p>
            <p className="mt-2 text-sm text-slate-600">{recommendedPaths[onboardingProfile.recommendedPath].description}</p>
            <div className="mt-4 grid gap-6 xl:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-950">判断依据</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {stageAssessment.rationale.map((item) => (
                    <p key={item}>- {item}</p>
                  ))}
                  {snapshot.maturityStage ? <p>- 当前训练复盘侧判断为：{snapshot.maturityStage}</p> : null}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">推荐初始化动作</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {stageAssessment.nextActions.map((item) => (
                    <p key={item}>- {item}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <RiskBlock
            risk="阶段判断是轻量启发式规则，不是绝对诊断。它更适合给出第一周优先级，而不是替代业务负责人拍板。"
            next="如果企业数据还很少，先按“基础配置路径”走，等真实使用数据上来后再复盘。"
          />
          <ActionRow primaryHref={`${base}/market-claw/insights`} primaryLabel="去看训练复盘" skipHref="#step-3" />
          </Card>
        </section>

        <section id="step-3">
          <Card>
          <StepHeader step="步骤三" title="业务线初始化" done={snapshot.activeBusinessLineCount >= 1} warning />
          <p className="mt-3 text-sm leading-6 text-slate-600">
            不建议企业一上来就配置太多产品或服务。更稳妥的方式，是先用 1～3 条核心业务线把客户、资料、训练和话术跑通。
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="当前已有业务线数量" value={`${snapshot.activeBusinessLineCount} 条`} />
            <InfoCard label="启用中的业务线" value={snapshot.businessLineNames.length ? snapshot.businessLineNames.join("、") : "当前还没有启用业务线"} />
            <InfoCard label="建议起步规模" value="先配置 1～3 条核心业务线" />
            <InfoCard label="推荐业务线类型" value="核心产品、核心服务、咨询服务、项目服务、售后服务" />
          </div>
          <RiskBlock
            risk="第一天如果把业务线铺得太多，后续客户导入、资料投喂和销售训练都会被拉散，反而更难跑通。"
            next="先选最核心、最常卖、最容易成交的几条业务线开跑。"
          />
          <ActionRow
            primaryHref={`${base}/business-lines`}
            primaryLabel="去业务配置"
            secondaryHref={`${base}/business-lines#product-overview`}
            secondaryLabel="查看现有样板业务线"
            skipHref="#step-4"
          />
          </Card>
        </section>

        <section id="step-4">
          <Card>
          <StepHeader step="步骤四" title="客户数据准备" done={snapshot.leadCount >= 1 || snapshot.importBatchCount >= 1} warning />
          <p className="mt-3 text-sm leading-6 text-slate-600">
            新企业最容易卡住的不是系统能不能导入，而是不知道第一批客户该怎么选。建议先导 20～100 个有效客户做试运行，不要一开始就导入大量脏数据。
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="当前客户数量" value={`${snapshot.leadCount} 个`} />
            <InfoCard label="最近导入批次数" value={`${snapshot.recentImportBatchCount} 批 / 30 天`} />
            <InfoCard label="累计导入批次数" value={`${snapshot.importBatchCount} 批`} />
            <InfoCard label="来源归因记录" value={`${snapshot.sourceAttributionCount} 条`} />
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">建议优先准备这些字段</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4 text-sm text-slate-600">
              {["客户名称", "公司", "手机", "业务线", "来源", "负责人", "当前阶段", "标签"].map((item) => (
                <p key={item}>- {item}</p>
              ))}
            </div>
          </div>
          <RiskBlock
            risk="如果导入的数据没有负责人、来源和业务线，后续跟进工作台和训练复盘都会失真。"
            next="先导入最有价值的一批客户，再逐步扩大数据范围。"
          />
          <ActionRow
            primaryHref={`${base}/imports`}
            primaryLabel="去客户导入"
            secondaryHref={`${base}/imports/template.csv`}
            secondaryLabel="下载导入模板"
            skipHref="#step-5"
          />
          </Card>
        </section>

        <section id="step-5">
          <Card>
          <StepHeader step="步骤五" title="Market Claw 资料投喂准备" done={snapshot.ingestionBatchCount >= 1 || snapshot.materialsCount >= 1} warning />
          <p className="mt-3 text-sm leading-6 text-slate-600">
            资料投喂不是为了把所有材料一口气丢进去，而是先准备最关键的企业介绍、产品介绍、FAQ、价格说明和风险边界，让 Market Claw 有稳妥可用的内容。
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="资料投喂批次数" value={`${snapshot.ingestionBatchCount} 批`} />
            <InfoCard label="候选知识数量" value={`${snapshot.candidateCount} 条`} />
            <InfoCard label="已采纳知识数量" value={`${totalKnowledgeCount} 条`} />
            <InfoCard label="知识缺口提醒" value={snapshot.knowledgeGaps.length ? snapshot.knowledgeGaps.join("；") : "当前没有明显缺口提醒"} />
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">推荐优先准备的资料</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3 text-sm text-slate-600">
              {["企业介绍", "产品介绍", "服务说明", "百问百答", "价格说明", "成功案例", "交付流程", "常见异议", "风险边界", "不建议承诺事项", "售后说明", "合同前沟通注意事项"].map((item) => (
                <p key={item}>- {item}</p>
              ))}
            </div>
          </div>
          <RiskBlock
            risk="如果没有价格边界、风险提醒和不能承诺事项，销售越早使用，越容易把口径说散。"
            next="优先投喂最能降低风险的资料，而不是先追求资料数量。"
          />
          <ActionRow
            primaryHref={`${base}/market-claw/ingestion`}
            primaryLabel="去资料投喂"
            secondaryHref={`${base}/market-claw/insights`}
            secondaryLabel="去训练复盘"
            skipHref="#step-6"
          />
          </Card>
        </section>

        <section id="step-6">
          <Card>
          <StepHeader step="步骤六" title="销售使用准备" done={snapshot.activeSalesCount >= 1 && snapshot.salesWithLeadsCount >= 1} warning />
          <p className="mt-3 text-sm leading-6 text-slate-600">
            系统只有管理员在配、销售没有真正开始用，就还不算跑起来。初始化的关键，是让销售尽快在真实客户场景里开始用，而不是只停留在后台配置。
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="当前销售用户数量" value={`${snapshot.activeSalesCount} 人`} />
            <InfoCard label="有负责客户的销售数量" value={`${snapshot.salesWithLeadsCount} 人`} />
            <InfoCard label="近期 Market Claw 使用记录" value={`${snapshot.recentMarketClawUsageCount} 次 / 14 天`} />
            <InfoCard label="销售训练样本数量" value={`${snapshot.salesTrainingSampleCount} 条`} />
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">推荐销售第一周动作</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <p>- 每天先看跟进工作台。</p>
              <p>- 每个重点客户至少生成一次回复。</p>
              <p>- 遇到真实客户问题就进入“我的训练”。</p>
              <p>- 好用话术先保存为个人常用。</p>
              <p>- 优秀话术再提交审核，不要跳过人工边界。</p>
            </div>
          </div>
          <RiskBlock
            risk="如果销售没有客户负责人、没有任务节奏或没有基础知识支持，初始化向导再完整也很难真正跑起来。"
            next="先让至少 1 名销售带着真实客户试跑，再逐步复制到更多人。"
          />
          <ActionRow
            primaryHref={`${base}/todos`}
            primaryLabel="去跟进工作台"
            secondaryHref={`${base}/market-claw`}
            secondaryLabel="去 Market Claw"
            skipHref="#step-7"
          />
          </Card>
        </section>

        <section id="step-7">
          <Card>
          <StepHeader step="步骤七" title="上线检查清单" done={checklist.filter((item) => item.done).length >= 4} warning />
          <p className="mt-3 text-sm leading-6 text-slate-600">
            这份清单不追求一步到位，而是帮助企业判断现在到底是“还没准备好”“可以试用”“适合小范围试运行”还是“可以正式内部使用”。
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">当前上线准备度</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{readiness}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{onboardingProfile.readinessExplanation}</p>
          </div>
          <div className="mt-4 space-y-3">
            {checklist.map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{item.title}</p>
                    <p className="mt-2 text-sm text-slate-600">当前数量：{item.currentValue}</p>
                    <p className="mt-1 text-sm text-slate-600">建议动作：{item.action}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${item.done ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {item.done ? "已完成" : "未完成"}
                    </span>
                    <div className="mt-3">
                      <Link className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" href={`${base}/${item.href}`}>
                        去处理
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <RiskBlock
            risk="初始化向导不是一次性做完就结束。只要企业还在补客户、补资料、补训练、补知识，这份清单就会持续变化。"
            next="先把最小闭环跑起来，再通过训练复盘和知识治理持续优化。"
          />
          <ActionRow
            primaryHref={`${base}/dashboard`}
            primaryLabel="回到首页继续推进"
            secondaryHref={`${base}/market-claw/insights`}
            secondaryLabel="去看训练复盘"
            skipHref="#step-1"
          />
          </Card>
        </section>
      </div>
    </PageShell>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function RiskBlock({ risk, next }: { risk: string; next: string }) {
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-slate-950">风险提醒</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{risk}</p>
      <p className="mt-3 text-sm font-semibold text-slate-950">下一步建议</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{next}</p>
    </div>
  );
}
