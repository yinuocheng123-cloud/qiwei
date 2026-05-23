/*
 * 文件说明：该文件实现 V2.0.5 Market Claw 训练场与“我的训练”页面。
 * 功能说明：支持企业训练、部门训练、业务线训练和销售自我训练，并在同一页面完成个人保存与提交审核。
 *
 * 结构概览：
 *   第一部分：导入依赖与选项
 *   第二部分：训练场页面
 *   第三部分：训练卡片与辅助展示
 */
import {
  generateMarketClawTrainingCase,
  saveMarketClawTrainingAsPersonalKnowledge,
  submitMarketClawTrainingForReview
} from "@/lib/actions";
import { redirect } from "next/navigation";
import { canAccessMarketClawTraining, canReviewMarketClawTraining, requireTenantAccess } from "@/lib/auth";
import {
  marketClawReplyRiskLevelLabels,
  marketClawSendModeLabels,
  marketClawTrainingReviewStatusOptions,
  marketClawTrainingScopeOptions
} from "@/lib/market-claw";
import { customerTypeOptions, stageOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Callout, Card, Input, SectionTabs, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

const scopeLabels = new Map(marketClawTrainingScopeOptions.map((item) => [item.value, item.label]));
const reviewStatusLabels = new Map(marketClawTrainingReviewStatusOptions.map((item) => [item.value, item.label]));

function buildOverviewTabs(tenantSlug: string, role: string) {
  if (role === "SALES") {
    return [
      { key: "overview", label: "总览", href: `/app/${tenantSlug}/market-claw` },
      { key: "training", label: "我的训练", href: `/app/${tenantSlug}/market-claw/training` },
      { key: "insights", label: "我的训练表现", href: `/app/${tenantSlug}/market-claw/insights` },
      { key: "replies", label: "我的回复记录", href: `/app/${tenantSlug}/market-claw/replies` },
      { key: "leads", label: "去客户列表", href: `/app/${tenantSlug}/leads` }
    ];
  }

  return [
    { key: "overview", label: "总览", href: `/app/${tenantSlug}/market-claw` },
    { key: "knowledge", label: "知识库", href: `/app/${tenantSlug}/market-claw/knowledge` },
    { key: "ingestion", label: "资料投喂", href: `/app/${tenantSlug}/market-claw/ingestion` },
    { key: "training", label: "回复训练场", href: `/app/${tenantSlug}/market-claw/training` },
    { key: "review", label: "训练审核", href: `/app/${tenantSlug}/market-claw/training/review` },
    { key: "insights", label: "训练复盘", href: `/app/${tenantSlug}/market-claw/insights` },
    { key: "replies", label: "回复记录", href: `/app/${tenantSlug}/market-claw/replies` }
  ];
}

function buildScopeTabs(tenantSlug: string, role: string) {
  if (role === "SALES") {
    return [{ key: "SALES_SELF_TRAINING", label: "我的训练", href: `/app/${tenantSlug}/market-claw/training?scope=SALES_SELF_TRAINING` }];
  }

  return marketClawTrainingScopeOptions.map((item) => ({
    key: item.value,
    label: item.label,
    href: `/app/${tenantSlug}/market-claw/training?scope=${item.value}`
  }));
}

async function safeTrainingRead<T>(read: () => Promise<T>, fallback: T): Promise<{ data: T; unavailable: boolean }> {
  try {
    return { data: await read(), unavailable: false };
  } catch {
    return { data: fallback, unavailable: true };
  }
}

export default async function MarketClawTrainingPage({
  params,
  searchParams
}: {
  params: { tenantSlug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  if (!canAccessMarketClawTraining(user.role)) {
    redirect("/forbidden");
  }
  const roleView = user.role as string;

  const availableScopes =
    roleView === "SALES" ? ["SALES_SELF_TRAINING"] : marketClawTrainingScopeOptions.map((item) => item.value);
  const requestedScope = typeof searchParams?.scope === "string" ? searchParams.scope : "";
  const currentScope = availableScopes.includes(requestedScope) ? requestedScope : availableScopes[0];

  const [businessLinesResult, trainingCasesResult] = await Promise.all([
    safeTrainingRead(
      () =>
        prisma.businessLine.findMany({
          where: { tenantId: tenant.id, status: "ACTIVE" },
          orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
        }),
      []
    ),
    safeTrainingRead(
      () =>
        prisma.marketClawTrainingCase.findMany({
          where: {
            tenantId: tenant.id,
            ...(roleView === "SALES" ? { ownerUserId: user.id } : {}),
            ...(currentScope ? { trainingScope: currentScope as never } : {})
          },
          include: {
            businessLine: true,
            createdBy: true,
            promotedKnowledgeItem: true
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: 20
        }),
      []
    )
  ]);
  const businessLines = businessLinesResult.data;
  const trainingCases = trainingCasesResult.data;
  const trainingDataUnavailable = businessLinesResult.unavailable || trainingCasesResult.unavailable;

  const generateAction = generateMarketClawTrainingCase.bind(null, tenant.slug);

  return (
    <PageShell
      tenant={tenant}
      title={roleView === "SALES" ? "Market Claw 我的训练" : "Market Claw 回复训练场"}
      breadcrumbs={[
        { label: "Market Claw", href: `/app/${tenant.slug}/market-claw` },
        { label: roleView === "SALES" ? "我的训练" : "回复训练场" }
      ]}
      description={
        roleView === "SALES"
          ? "把一线真实客户问题练成自己的常用话术。个人训练默认只供自己使用，提交审核后才可能升级为团队标准或企业标准。"
          : "在这里区分企业训练、部门训练、业务线训练和销售自我训练，保证训练素材能沉淀，但不会直接污染企业标准知识。"
      }
    >
      <SectionTabs current="training" items={buildOverviewTabs(tenant.slug, roleView)} className="mb-4" />
      <SectionTabs current={currentScope} items={buildScopeTabs(tenant.slug, roleView)} className="mb-6" />

      {trainingDataUnavailable ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          当前复盘数据暂不可用，不影响销售主流程。
        </div>
      ) : null}

      <Callout title={roleView === "SALES" ? "销售训练原则" : "训练分层原则"} tone={roleView === "SALES" ? "emerald" : "amber"}>
        {roleView === "SALES"
          ? "先把客户真实问题练成自己的可用回复，再决定是否提交审核。个人常用话术不会直接进入企业知识库，也不能覆盖不能承诺事项。"
          : "企业训练、部门训练、业务线训练和销售自我训练必须分层保存。任何个人训练都要经过审核后，才能升级为团队标准或企业标准。"}
      </Callout>

      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-slate-950">{roleView === "SALES" ? "开始我的训练" : "开始新一轮训练"}</h2>
          <form action={generateAction} className="space-y-4">
            {roleView === "SALES" ? <input name="trainingScope" type="hidden" value="SALES_SELF_TRAINING" /> : null}
            {roleView !== "SALES" ? (
              <Select label="训练类型" name="trainingScope" options={marketClawTrainingScopeOptions} defaultValue={currentScope} />
            ) : null}
            <Textarea label="客户真实问题" name="customerQuestion" rows={4} />
            <Select
              label="业务线"
              name="businessLineId"
              options={[
                { value: "", label: "不绑定业务线，按通用训练处理" },
                ...businessLines.map((item) => ({ value: item.id, label: item.name }))
              ]}
              defaultValue={businessLines[0]?.id ?? ""}
            />
            <Select label="客户类型" name="customerType" options={customerTypeOptions} defaultValue="FACTORY_CLIENT" />
            <Select label="客户阶段" name="customerStage" options={stageOptions} defaultValue="NEW" />
            <Textarea label="客户标签" name="customerTags" rows={2} />
            <Input label="回复风格备注" name="replyStyle" defaultValue={roleView === "SALES" ? "像销售本人，不像客服" : "像销售，不像客服"} />
            <Input label="回复长度备注" name="replyLength" defaultValue="微信可直接发" />
            <Textarea label="销售备注" name="salesNote" rows={3} />
            <SubmitButton>{roleView === "SALES" ? "生成我的训练回复" : "生成训练结果"}</SubmitButton>
          </form>
        </Card>

        <div className="space-y-4">
          {trainingCases.length ? (
            trainingCases.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                        {scopeLabels.get(item.trainingScope) ?? item.trainingScope}
                      </span>
                      <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-emerald-700">
                        {reviewStatusLabels.get(item.reviewStatus) ?? item.reviewStatus}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">{item.departmentName ?? "未标记部门"}</span>
                      <span className="rounded-md bg-amber-50 px-2.5 py-1 text-amber-700">
                        {marketClawReplyRiskLevelLabels[item.replyRiskLevel]}
                      </span>
                      <span className="rounded-md bg-sky-50 px-2.5 py-1 text-sky-700">
                        {marketClawSendModeLabels[item.sendMode]}
                      </span>
                      {item.requiresReview ? <span className="rounded-md bg-rose-50 px-2.5 py-1 text-rose-700">建议边界确认</span> : null}
                      {item.businessLine ? (
                        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">{item.businessLine.name}</span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-slate-950">{item.customerQuestion}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      提交人：{item.createdBy.name} / 更新时间：
                      {new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.updatedAt))}
                    </p>
                  </div>
                  {item.promotedKnowledgeItem ? (
                    <span className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                      已沉淀：{item.promotedKnowledgeItem.scopeLevel}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <ReplyView title="简短微信版" value={item.generatedShortReply} />
                  <ReplyView title="专业说明版" value={item.generatedProfessionalReply} />
                  <ReplyView title="推进成交版" value={item.generatedClosingReply} />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <ReplyView title="人工优化版本" value={item.manualOptimizedReply} rows={5} />
                  <ReplyView title="风险提醒与不能承诺事项" value={item.forbiddenNotes} rows={5} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                  <Info label="训练类型" value={scopeLabels.get(item.trainingScope) ?? item.trainingScope} />
                  <Info label="当前状态" value={reviewStatusLabels.get(item.reviewStatus) ?? item.reviewStatus} />
                  <Info label="建议风险等级" value={marketClawReplyRiskLevelLabels[item.replyRiskLevel]} />
                  <Info label="建议使用模式" value={marketClawSendModeLabels[item.sendMode]} />
                  <Info label="风险原因" value={item.riskReason ?? "-"} />
                  <Info label="审核时间" value={item.reviewedAt ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.reviewedAt)) : "-"} />
                  <Info label="驳回或审核意见" value={item.reviewComment ?? "-"} />
                </div>

                {roleView === "SALES" ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <form
                      action={saveMarketClawTrainingAsPersonalKnowledge.bind(null, tenant.slug, item.id)}
                      className="space-y-3 rounded-md border border-slate-200 bg-white p-4"
                    >
                      <h3 className="text-sm font-semibold text-slate-950">保存为个人常用话术</h3>
                      <Input label="个人话术标题" name="knowledgeTitle" defaultValue={`个人话术：${item.customerQuestion.slice(0, 24)}`} />
                      <Textarea
                        label="最终回复版本"
                        name="manualOptimizedReply"
                        defaultValue={item.manualOptimizedReply ?? item.generatedProfessionalReply ?? item.generatedShortReply ?? ""}
                        rows={4}
                      />
                      <Textarea label="风险提醒" name="forbiddenNotes" defaultValue={item.forbiddenNotes ?? ""} rows={3} />
                      <SubmitButton>保存为个人常用话术</SubmitButton>
                    </form>

                    <form
                      action={submitMarketClawTrainingForReview.bind(null, tenant.slug, item.id)}
                      className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4"
                    >
                      <h3 className="text-sm font-semibold text-slate-950">提交训练审核</h3>
                      <Textarea
                        label="提交审核版本"
                        name="manualOptimizedReply"
                        defaultValue={item.manualOptimizedReply ?? item.generatedProfessionalReply ?? item.generatedShortReply ?? ""}
                        rows={4}
                      />
                      <Textarea label="销售备注" name="salesNote" defaultValue={item.salesNote ?? ""} rows={3} />
                      <Textarea label="风险提醒" name="forbiddenNotes" defaultValue={item.forbiddenNotes ?? ""} rows={3} />
                      <SubmitButton>提交训练结果审核</SubmitButton>
                    </form>
                  </div>
                ) : canReviewMarketClawTraining(user.role) ? (
                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">管理提示</p>
                    <p className="mt-2 leading-6">
                      这条训练样本可以继续进入“训练审核”页面处理，决定采纳为团队标准、采纳为企业标准，或驳回并填写原因。
                    </p>
                  </div>
                ) : null}
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm text-slate-500">
                {roleView === "SALES"
                  ? "你还没有“我的训练”记录。先拿一个真实客户问题练一轮回复，再决定是保存为个人话术还是提交审核。"
                  : "当前训练类型下还没有训练记录。先跑一轮问题，再根据回复质量决定是否进入审核。"}
              </p>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function ReplyView({ title, value, rows = 6 }: { title: string; value?: string | null; rows?: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <textarea className="mt-3 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800" rows={rows} readOnly value={value ?? "-"} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}
