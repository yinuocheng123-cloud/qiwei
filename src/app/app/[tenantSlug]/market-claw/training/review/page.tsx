/*
 * 文件说明：该文件实现 V2.0.5 Market Claw 训练审核页面。
 * 功能说明：允许管理员与运营查看待审核训练、采纳为团队标准或企业标准，并记录驳回原因。
 *
 * 结构概览：
 *   第一部分：导入依赖与选项
 *   第二部分：训练审核页面
 *   第三部分：辅助展示组件
 */
import { reviewMarketClawTrainingCase, saveMarketClawTrainingAsKnowledge } from "@/lib/actions";
import { canReviewMarketClawTraining, requireTenantAccess } from "@/lib/auth";
import {
  marketClawKnowledgeScopeOptions,
  marketClawReplyRiskLevelLabels,
  marketClawReplyRiskLevelOptions,
  marketClawSendModeLabels,
  marketClawSendModeOptions,
  marketClawTrainingReviewStatusOptions,
  marketClawTrainingScopeOptions
} from "@/lib/market-claw";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Callout, Card, SectionTabs, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

const scopeLabels = new Map(marketClawTrainingScopeOptions.map((item) => [item.value, item.label]));
const reviewStatusLabels = new Map(marketClawTrainingReviewStatusOptions.map((item) => [item.value, item.label]));

export default async function MarketClawTrainingReviewPage({
  params
}: {
  params: { tenantSlug: string };
}) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canReviewMarketClawTraining(user.role)) {
    return null;
  }

  const trainingCases = await prisma.marketClawTrainingCase.findMany({
    where: {
      tenantId: tenant.id,
      reviewStatus: { in: ["PENDING_REVIEW", "REJECTED", "TEAM_APPROVED", "ENTERPRISE_APPROVED"] }
    },
    include: {
      businessLine: true,
      createdBy: true,
      promotedKnowledgeItem: true
    },
    orderBy: [{ submittedForReviewAt: "desc" }, { updatedAt: "desc" }],
    take: 30
  });

  return (
    <PageShell
      tenant={tenant}
      title="Market Claw 训练审核"
      breadcrumbs={[
        { label: "Market Claw", href: `/app/${tenant.slug}/market-claw` },
        { label: "训练审核" }
      ]}
      description="销售提交的训练样本不会直接进入企业知识库。这里要先判断边界是否安全，再决定是采纳为团队标准、采纳为企业标准，还是驳回纠偏。"
    >
      <SectionTabs
        current="review"
        items={[
          { key: "overview", label: "总览", href: `/app/${tenant.slug}/market-claw` },
          { key: "knowledge", label: "知识库", href: `/app/${tenant.slug}/market-claw/knowledge` },
          { key: "ingestion", label: "资料投喂", href: `/app/${tenant.slug}/market-claw/ingestion` },
          { key: "training", label: "回复训练场", href: `/app/${tenant.slug}/market-claw/training` },
          { key: "review", label: "训练审核", href: `/app/${tenant.slug}/market-claw/training/review` },
          { key: "insights", label: "训练复盘", href: `/app/${tenant.slug}/market-claw/insights` },
          { key: "replies", label: "回复记录", href: `/app/${tenant.slug}/market-claw/replies` }
        ]}
        className="mb-6"
      />

      <Callout title="审核原则" tone="amber">
        不能承诺事项、价格边界、效果边界仍然是最高优先级。任何个人训练都必须先过审核，才能升级成团队或企业可复用知识。
      </Callout>

      <div className="mt-6 space-y-4">
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
                    {item.businessLine ? <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">{item.businessLine.name}</span> : null}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950">{item.customerQuestion}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    提交人：{item.createdBy.name} / 提交时间：
                    {item.submittedForReviewAt
                      ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.submittedForReviewAt))
                      : "-"}
                  </p>
                </div>
                {item.promotedKnowledgeItem ? (
                  <span className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    已采纳：{item.promotedKnowledgeItem.scopeLevel}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Panel title="系统原始回复" value={item.generatedProfessionalReply ?? item.generatedShortReply ?? "-"} />
                <Panel title="销售修改版本" value={item.manualOptimizedReply ?? "-"} />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Panel title="销售备注" value={item.salesNote ?? "-"} rows={4} />
                <Panel title="风险提醒" value={item.forbiddenNotes ?? "-"} rows={4} />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                <Info label="系统建议风险等级" value={marketClawReplyRiskLevelLabels[item.replyRiskLevel]} />
                <Info label="建议使用模式" value={marketClawSendModeLabels[item.sendMode]} />
                <Info label="是否建议负责人介入" value={item.replyRiskLevel === "BLOCKED" ? "是" : item.requiresReview ? "必要时介入" : "否"} />
                <Info label="风险原因" value={item.riskReason ?? "-"} />
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <form
                  action={reviewMarketClawTrainingCase.bind(null, tenant.slug, item.id)}
                  className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4"
                >
                  <h3 className="text-sm font-semibold text-slate-950">保存审核结论</h3>
                  <Select
                    label="审核状态"
                    name="reviewStatus"
                    options={[
                      { value: "PENDING_REVIEW", label: "待审核" },
                      { value: "REJECTED", label: "驳回" },
                      { value: "DISMISSED", label: "停用" }
                    ]}
                    defaultValue={item.reviewStatus}
                  />
                  <Textarea label="审核后回复版本" name="manualOptimizedReply" defaultValue={item.manualOptimizedReply ?? item.generatedProfessionalReply ?? ""} rows={4} />
                  <Select label="回复风险等级" name="replyRiskLevel" options={marketClawReplyRiskLevelOptions} defaultValue={item.replyRiskLevel} />
                  <Select label="使用模式" name="sendMode" options={marketClawSendModeOptions} defaultValue={item.sendMode} />
                  <Textarea label="审核意见或驳回原因" name="reviewComment" defaultValue={item.reviewComment ?? ""} rows={3} />
                  <Textarea label="风险提醒" name="forbiddenNotes" defaultValue={item.forbiddenNotes ?? ""} rows={3} />
                  <Textarea label="风险原因" name="riskReason" defaultValue={item.riskReason ?? ""} rows={2} />
                  <Textarea label="内部建议备注" name="internalOnlyNote" defaultValue={item.internalOnlyNote ?? ""} rows={2} />
                  <SubmitButton>保存审核结论</SubmitButton>
                </form>

                <form
                  action={saveMarketClawTrainingAsKnowledge.bind(null, tenant.slug, item.id)}
                  className="space-y-3 rounded-md border border-slate-200 bg-white p-4"
                >
                  <h3 className="text-sm font-semibold text-slate-950">采纳为团队标准</h3>
                  <input name="scopeLevel" type="hidden" value={item.businessLineId ? "BUSINESS_LINE" : "DEPARTMENT"} />
                  <input name="reviewComment" type="hidden" value="采纳为团队标准" />
                  <Textarea label="最终采纳版本" name="manualOptimizedReply" defaultValue={item.manualOptimizedReply ?? item.generatedProfessionalReply ?? ""} rows={4} />
                  <Select label="回复风险等级" name="replyRiskLevel" options={marketClawReplyRiskLevelOptions} defaultValue={item.replyRiskLevel} />
                  <Select label="使用模式" name="sendMode" options={marketClawSendModeOptions} defaultValue={item.sendMode} />
                  <Textarea label="不能承诺事项" name="forbiddenPhraseList" rows={3} />
                  <Textarea label="风险提醒" name="forbiddenNotes" defaultValue={item.forbiddenNotes ?? ""} rows={3} />
                  <Textarea label="风险原因" name="riskReason" defaultValue={item.riskReason ?? ""} rows={2} />
                  <SubmitButton>采纳为团队标准</SubmitButton>
                </form>

                <form
                  action={saveMarketClawTrainingAsKnowledge.bind(null, tenant.slug, item.id)}
                  className="space-y-3 rounded-md border border-slate-200 bg-white p-4"
                >
                  <h3 className="text-sm font-semibold text-slate-950">采纳为企业标准</h3>
                  <Select
                    label="采纳层级"
                    name="scopeLevel"
                    options={marketClawKnowledgeScopeOptions.filter((option) => ["ENTERPRISE", "BUSINESS_LINE", "DEPARTMENT"].includes(option.value))}
                    defaultValue="ENTERPRISE"
                  />
                  <Textarea label="最终采纳版本" name="manualOptimizedReply" defaultValue={item.manualOptimizedReply ?? item.generatedProfessionalReply ?? ""} rows={4} />
                  <Select label="回复风险等级" name="replyRiskLevel" options={marketClawReplyRiskLevelOptions} defaultValue={item.replyRiskLevel} />
                  <Select label="使用模式" name="sendMode" options={marketClawSendModeOptions} defaultValue={item.sendMode} />
                  <Textarea label="不能承诺事项" name="forbiddenPhraseList" rows={3} />
                  <Textarea label="审核意见" name="reviewComment" defaultValue="采纳为企业标准" rows={3} />
                  <Textarea label="风险提醒" name="forbiddenNotes" defaultValue={item.forbiddenNotes ?? ""} rows={3} />
                  <Textarea label="风险原因" name="riskReason" defaultValue={item.riskReason ?? ""} rows={2} />
                  <SubmitButton>采纳为企业标准</SubmitButton>
                </form>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm text-slate-500">当前没有待审核训练。销售提交训练样本后，这里会显示待处理记录。</p>
          </Card>
        )}
      </div>
    </PageShell>
  );
}

function Panel({ title, value, rows = 6 }: { title: string; value: string; rows?: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <textarea className="mt-3 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800" rows={rows} readOnly value={value} />
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
