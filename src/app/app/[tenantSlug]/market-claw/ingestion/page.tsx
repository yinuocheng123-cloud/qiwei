/*
 * 文件说明：该文件实现 V2.0.6 Market Claw 资料投喂与候选知识生成页面。
 * 功能说明：允许管理员和运营提交资料、生成候选知识、人工采纳入库或驳回，并保留资料来源批次与候选审核记录。
 *
 * 结构概览：
 *   第一部分：导入依赖与标签映射
 *   第二部分：候选知识辅助展示组件
 *   第三部分：资料投喂页面
 */
import {
  adoptMarketClawKnowledgeCandidate,
  createMarketClawIngestionBatch,
  mergeMarketClawKnowledgeCandidate,
  rejectMarketClawKnowledgeCandidate
} from "@/lib/actions";
import { canAccessMarketClawIngestion, requireTenantAccess } from "@/lib/auth";
import {
  marketClawIngestionSourceTypeOptions,
  marketClawIngestionStatusOptions,
  marketClawKnowledgeCandidateReviewStatusOptions,
  marketClawKnowledgeScopeOptions,
  marketClawKnowledgeTypeOptions
} from "@/lib/market-claw";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Callout, Card, Input, SectionTabs, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

const sourceTypeLabels = new Map(marketClawIngestionSourceTypeOptions.map((item) => [item.value, item.label]));
const batchStatusLabels = new Map(marketClawIngestionStatusOptions.map((item) => [item.value, item.label]));
const candidateStatusLabels = new Map(marketClawKnowledgeCandidateReviewStatusOptions.map((item) => [item.value, item.label]));
const knowledgeTypeLabels = new Map(marketClawKnowledgeTypeOptions.map((item) => [item.value, item.label]));
const scopeLabels = new Map(marketClawKnowledgeScopeOptions.map((item) => [item.value, item.label]));

function buildOverviewTabs(tenantSlug: string) {
  return [
    { key: "overview", label: "总览", href: `/app/${tenantSlug}/market-claw` },
    { key: "knowledge", label: "知识库", href: `/app/${tenantSlug}/market-claw/knowledge` },
    { key: "training", label: "回复训练场", href: `/app/${tenantSlug}/market-claw/training` },
    { key: "review", label: "训练审核", href: `/app/${tenantSlug}/market-claw/training/review` },
    { key: "ingestion", label: "资料投喂", href: `/app/${tenantSlug}/market-claw/ingestion` },
    { key: "replies", label: "回复记录", href: `/app/${tenantSlug}/market-claw/replies` }
  ];
}

function CandidatePanel({ title, value, rows = 4 }: { title: string; value?: string | null; rows?: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <textarea
        className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800"
        rows={rows}
        readOnly
        value={value && value.trim() ? value : "-"}
      />
    </div>
  );
}

export default async function MarketClawIngestionPage({
  params,
  searchParams
}: {
  params: { tenantSlug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canAccessMarketClawIngestion(user.role)) {
    return null;
  }

  const reviewStatus = typeof searchParams?.reviewStatus === "string" ? searchParams.reviewStatus : "";
  const batchId = typeof searchParams?.batchId === "string" ? searchParams.batchId : "";

  const [businessLines, batches, candidates] = await Promise.all([
    prisma.businessLine.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.marketClawIngestionBatch.findMany({
      where: { tenantId: tenant.id },
      include: {
        businessLine: true,
        createdBy: true
      },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.marketClawKnowledgeCandidate.findMany({
      where: {
        tenantId: tenant.id,
        ...(reviewStatus ? { reviewStatus: reviewStatus as never } : {}),
        ...(batchId ? { batchId } : {})
      },
      include: {
        batch: true,
        businessLine: true,
        createdBy: true
      },
      orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
      take: 24
    })
  ]);

  const createAction = createMarketClawIngestionBatch.bind(null, tenant.slug);

  return (
    <PageShell
      tenant={tenant}
      title="Market Claw 资料投喂"
      breadcrumbs={[
        { label: "Market Claw", href: `/app/${tenant.slug}/market-claw` },
        { label: "资料投喂" }
      ]}
      description="把百问百答、服务说明、案例素材、价格边界和风险提醒先整理成候选知识，再由人工审核后决定是否进入知识库。当前版本只做文本粘贴和轻量文件导入，不做复杂 PDF / Word / PPT 解析。"
    >
      <SectionTabs current="ingestion" items={buildOverviewTabs(tenant.slug)} className="mb-6" />

      <Callout title="投喂原则" tone="amber">
        资料投喂的目标是先拆出候选知识，而不是直接把资料变成企业标准。系统只做规则拆解，所有候选内容都必须人工审核后才能采纳入库，尤其是价格边界、不能承诺事项和风险提醒。
      </Callout>

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">新增资料投喂批次</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              支持先粘贴文本，也支持补充 TXT、Markdown、CSV 文件。当前版本只做轻量文本读取，适合先把 FAQ、产品资料、案例说明和风险边界整理成候选知识。
            </p>
            <form action={createAction} className="mt-4 space-y-4">
              <Input label="资料标题" name="title" required />
              <Select
                label="业务线"
                name="businessLineId"
                options={[{ value: "", label: "先按通用资料拆解" }, ...businessLines.map((item) => ({ value: item.id, label: item.name }))]}
              />
              <Select label="资料类型" name="sourceType" options={marketClawIngestionSourceTypeOptions} defaultValue="PASTED_TEXT" />
              <label className="block text-sm font-medium text-slate-700">
                可选文件
                <input
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  accept=".txt,.md,.markdown,.csv,text/plain,text/markdown,text/csv"
                  name="sourceFile"
                  type="file"
                />
              </label>
              <Textarea label="文本粘贴区" name="rawText" rows={12} />
              <SubmitButton>生成候选知识</SubmitButton>
            </form>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">最近批次</h2>
            <div className="mt-4 space-y-3">
              {batches.length ? (
                batches.map((batch) => (
                  <div key={batch.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">{batch.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {batch.businessLine?.name ?? "通用资料"} / {sourceTypeLabels.get(batch.sourceType) ?? batch.sourceType}
                        </p>
                      </div>
                      <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                        {batchStatusLabels.get(batch.status) ?? batch.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                      <p>候选知识：{batch.candidateCount}</p>
                      <p>已采纳：{batch.adoptedCount}</p>
                      <p>已驳回：{batch.rejectedCount}</p>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      创建人：{batch.createdBy.name} /{" "}
                      {new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(batch.createdAt))}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">当前还没有资料投喂批次，可以先投喂一段 FAQ 或服务说明。</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <form className="grid gap-4 md:grid-cols-3">
              <Select
                label="候选状态"
                name="reviewStatus"
                options={[{ value: "", label: "全部状态" }, ...marketClawKnowledgeCandidateReviewStatusOptions]}
                defaultValue={reviewStatus}
              />
              <Select
                label="所属批次"
                name="batchId"
                options={[{ value: "", label: "全部批次" }, ...batches.map((item) => ({ value: item.id, label: item.title }))]}
                defaultValue={batchId}
              />
              <div className="flex items-end">
                <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">筛选</button>
              </div>
            </form>
          </Card>

          {candidates.length ? (
            candidates.map((candidate) => (
              <Card key={candidate.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                        {knowledgeTypeLabels.get(candidate.knowledgeType) ?? candidate.knowledgeType}
                      </span>
                      <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-emerald-700">
                        {candidateStatusLabels.get(candidate.reviewStatus) ?? candidate.reviewStatus}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                        建议层级：{scopeLabels.get(candidate.suggestedScopeLevel) ?? candidate.suggestedScopeLevel}
                      </span>
                      {candidate.businessLine ? (
                        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">{candidate.businessLine.name}</span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-slate-950">{candidate.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      来源批次：{candidate.batch.title} / 创建人：{candidate.createdBy.name}
                    </p>
                  </div>
                  {candidate.adoptedKnowledgeItemId ? (
                    <span className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">已生成知识条目</span>
                  ) : null}
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{candidate.content}</p>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <CandidatePanel title="建议关键词" value={(Array.isArray(candidate.suggestedKeywords) ? candidate.suggestedKeywords.join("\n") : "") || "-"} />
                  <CandidatePanel
                    title="建议不能承诺事项"
                    value={(Array.isArray(candidate.suggestedForbiddenPhrases) ? candidate.suggestedForbiddenPhrases.join("\n") : "") || "-"}
                  />
                  <CandidatePanel title="风险提醒" value={candidate.suggestedRiskNotes} />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <CandidatePanel title="简短微信版" value={candidate.suggestedReplyShort} rows={5} />
                  <CandidatePanel title="专业说明版" value={candidate.suggestedReplyProfessional} rows={5} />
                  <CandidatePanel title="推进成交版" value={candidate.suggestedReplyClosing} rows={5} />
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  <form action={adoptMarketClawKnowledgeCandidate.bind(null, tenant.slug, candidate.id)} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-950">采纳入库</h3>
                    <Input label="知识标题" name="title" defaultValue={candidate.title} />
                    <Select label="知识类型" name="knowledgeType" options={marketClawKnowledgeTypeOptions} defaultValue={candidate.knowledgeType} />
                    <Select
                      label="采纳层级"
                      name="scopeLevel"
                      options={marketClawKnowledgeScopeOptions.filter((item) => ["ENTERPRISE", "DEPARTMENT", "BUSINESS_LINE"].includes(item.value))}
                      defaultValue={candidate.suggestedScopeLevel}
                    />
                    <Textarea label="知识正文" name="content" defaultValue={candidate.content} rows={5} />
                    <Textarea
                      label="建议关键词"
                      name="keywords"
                      defaultValue={Array.isArray(candidate.suggestedKeywords) ? candidate.suggestedKeywords.join("\n") : ""}
                      rows={3}
                    />
                    <Textarea
                      label="不能承诺事项"
                      name="forbiddenPhrases"
                      defaultValue={Array.isArray(candidate.suggestedForbiddenPhrases) ? candidate.suggestedForbiddenPhrases.join("\n") : ""}
                      rows={3}
                    />
                    <Textarea label="风险提醒" name="riskNotes" defaultValue={candidate.suggestedRiskNotes ?? ""} rows={3} />
                    <Textarea label="审核备注" name="reviewComment" defaultValue="" rows={2} />
                    <SubmitButton>采纳入库</SubmitButton>
                  </form>

                  <form action={rejectMarketClawKnowledgeCandidate.bind(null, tenant.slug, candidate.id)} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-950">驳回候选项</h3>
                    <input name="reviewStatus" type="hidden" value="REJECTED" />
                    <Textarea label="驳回原因" name="reviewComment" rows={5} />
                    <SubmitButton>驳回</SubmitButton>
                  </form>

                  <form action={mergeMarketClawKnowledgeCandidate.bind(null, tenant.slug, candidate.id)} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-950">标记合并</h3>
                    <Textarea
                      label="合并说明"
                      name="reviewComment"
                      defaultValue={candidate.reviewComment ?? "与现有知识条目合并处理，不单独入库。"}
                      rows={5}
                    />
                    <SubmitButton>标记为已合并</SubmitButton>
                  </form>
                </div>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm text-slate-500">当前没有候选知识。先投喂一段 FAQ、价格说明或风险边界，再回来人工审核。</p>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
