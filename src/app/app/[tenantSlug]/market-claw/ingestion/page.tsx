/*
 * 文件说明：该文件实现 V2.0.7 Market Claw 资料投喂与候选知识审核页。
 * 功能说明：支持资料投喂、候选知识查看、相似提示、采纳为新知识、合并到已有知识、补充追加、重复驳回与普通驳回。
 *
 * 结构概览：
 *   第一部分：导入依赖与展示辅助函数
 *   第二部分：候选知识审核子组件
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
  buildMarketClawMergedKnowledgeContent,
  findSimilarKnowledgeItems,
  marketClawIngestionSourceTypeOptions,
  marketClawIngestionStatusOptions,
  marketClawKnowledgeCandidateMergeActionOptions,
  marketClawKnowledgeCandidateReviewStatusOptions,
  marketClawKnowledgeScopeOptions,
  marketClawKnowledgeTypeOptions,
  parseMarketClawSimilarityHints,
  parseMarketClawTextArray
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
const mergeActionLabels = new Map(marketClawKnowledgeCandidateMergeActionOptions.map((item) => [item.value, item.label]));

function buildOverviewTabs(tenantSlug: string) {
  return [
    { key: "overview", label: "总览", href: `/app/${tenantSlug}/market-claw` },
    { key: "knowledge", label: "知识库", href: `/app/${tenantSlug}/market-claw/knowledge` },
    { key: "training", label: "回复训练场", href: `/app/${tenantSlug}/market-claw/training` },
    { key: "review", label: "训练审核", href: `/app/${tenantSlug}/market-claw/training/review` },
    { key: "ingestion", label: "资料投喂", href: `/app/${tenantSlug}/market-claw/ingestion` },
    { key: "insights", label: "训练复盘", href: `/app/${tenantSlug}/market-claw/insights` },
    { key: "replies", label: "回复记录", href: `/app/${tenantSlug}/market-claw/replies` }
  ];
}

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function summarizeText(value?: string | null, maxLength = 100) {
  const text = value?.trim() ?? "";
  if (!text) return "-";
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

function similarityTone(level: "HIGH" | "MEDIUM" | "LOW") {
  if (level === "HIGH") return "bg-rose-50 text-rose-700";
  if (level === "MEDIUM") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
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

function SimilarKnowledgePanel({
  tenantSlug,
  candidate,
  targetKnowledgeItem
}: {
  tenantSlug: string;
  candidate: {
    id: string;
    title: string;
    content: string;
    mergeReason: string | null;
  };
  targetKnowledgeItem: {
    id: string;
    title: string;
    content: string;
    businessLineName: string | null;
    similarityLevel: "HIGH" | "MEDIUM" | "LOW";
    reasons: string[];
    matchedKeywords: string[];
  };
}) {
  const mergeDraft = buildMarketClawMergedKnowledgeContent({
    action: "MERGE_INTO_EXISTING",
    targetTitle: targetKnowledgeItem.title,
    targetContent: targetKnowledgeItem.content,
    candidateTitle: candidate.title,
    candidateContent: candidate.content
  });
  const appendDraft = buildMarketClawMergedKnowledgeContent({
    action: "APPEND_TO_EXISTING",
    targetTitle: targetKnowledgeItem.title,
    targetContent: targetKnowledgeItem.content,
    candidateTitle: candidate.title,
    candidateContent: candidate.content
  });

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-950">{targetKnowledgeItem.title}</p>
          <p className="mt-1 text-xs text-slate-500">{targetKnowledgeItem.businessLineName ?? "通用知识"}</p>
        </div>
        <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${similarityTone(targetKnowledgeItem.similarityLevel)}`}>
          相似度：{targetKnowledgeItem.similarityLevel}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{summarizeText(targetKnowledgeItem.content, 120)}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {targetKnowledgeItem.reasons.map((reason) => (
          <span key={reason} className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
            {reason}
          </span>
        ))}
        {targetKnowledgeItem.matchedKeywords.map((keyword) => (
          <span key={keyword} className="rounded-md bg-emerald-50 px-2.5 py-1 text-emerald-700">
            {keyword}
          </span>
        ))}
      </div>

      <details className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-900">快速合并到这条知识</summary>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <CandidatePanel title="已有知识摘要" value={targetKnowledgeItem.content} rows={6} />
          <CandidatePanel title="候选知识摘要" value={candidate.content} rows={6} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <form action={mergeMarketClawKnowledgeCandidate.bind(null, tenantSlug, candidate.id)} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
            <input name="targetKnowledgeItemId" type="hidden" value={targetKnowledgeItem.id} />
            <input name="mergeAction" type="hidden" value="MERGE_INTO_EXISTING" />
            <Textarea label="合并后正文" name="mergedContent" defaultValue={mergeDraft} rows={8} />
            <Textarea
              label="合并原因"
              name="mergeReason"
              defaultValue={candidate.mergeReason ?? "与已有知识口径接近，整合后保留单一知识入口。"}
              rows={3}
            />
            <SubmitButton>修改后合并</SubmitButton>
          </form>

          <form action={mergeMarketClawKnowledgeCandidate.bind(null, tenantSlug, candidate.id)} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
            <input name="targetKnowledgeItemId" type="hidden" value={targetKnowledgeItem.id} />
            <input name="mergeAction" type="hidden" value="APPEND_TO_EXISTING" />
            <Textarea label="追加后正文" name="mergedContent" defaultValue={appendDraft} rows={8} />
            <Textarea
              label="追加原因"
              name="mergeReason"
              defaultValue="保留原知识主体，把候选内容作为补充说明追加。"
              rows={3}
            />
            <SubmitButton>作为补充追加</SubmitButton>
          </form>
        </div>
      </details>
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

  const [businessLines, batches, candidates, knowledgeItems] = await Promise.all([
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
    }),
    prisma.marketClawKnowledgeItem.findMany({
      where: {
        tenantId: tenant.id,
        status: "ACTIVE",
        reviewStatus: "APPROVED"
      },
      include: {
        businessLine: true
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      take: 80
    })
  ]);

  const createAction = createMarketClawIngestionBatch.bind(null, tenant.slug);
  const knowledgeItemMap = new Map(knowledgeItems.map((item) => [item.id, item]));
  const knowledgeOptions = knowledgeItems.map((item) => ({
    value: item.id,
    label: `${item.businessLine?.name ?? "通用知识"} / ${item.title}`
  }));

  const candidateViews = candidates.map((candidate) => {
    const storedHints = parseMarketClawSimilarityHints(candidate.similarityHints);
    const similarityHints =
      storedHints.length > 0
        ? storedHints
        : findSimilarKnowledgeItems({
            businessLineId: candidate.businessLineId,
            knowledgeType: candidate.knowledgeType,
            title: candidate.title,
            content: candidate.content,
            suggestedKeywords: parseMarketClawTextArray(candidate.suggestedKeywords),
            suggestedRiskNotes: candidate.suggestedRiskNotes,
            knowledgeItems
          });

    const similarKnowledgeItems = similarityHints
      .map((hint) => {
        const target = knowledgeItemMap.get(hint.knowledgeItemId);
        if (!target) return null;
        return {
          id: target.id,
          title: target.title,
          content: target.content,
          businessLineName: target.businessLine?.name ?? null,
          similarityLevel: hint.similarityLevel,
          reasons: hint.reasons,
          matchedKeywords: hint.matchedKeywords
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      ...candidate,
      similarKnowledgeItems
    };
  });

  return (
    <PageShell
      tenant={tenant}
      title="Market Claw 资料投喂"
      breadcrumbs={[
        { label: "Market Claw", href: `/app/${tenant.slug}/market-claw` },
        { label: "资料投喂" }
      ]}
      description="把百问百答、服务说明、案例资料、价格边界和风险提醒先整理成候选知识，再由人工审核决定是采纳为新知识、合并到已有知识、作为补充追加，还是标记为重复并驳回。"
    >
      <SectionTabs current="ingestion" items={buildOverviewTabs(tenant.slug)} className="mb-6" />

      <Callout title="本轮意图摘要" tone="amber">
        V2.0.7 的重点不是继续放大候选数量，而是先让知识库越用越干净。系统会继续保持人工审核边界，只补轻量相似提示、合并与来源追踪，不引入复杂知识版本系统，也不让候选内容直接进入正式知识库。
      </Callout>

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">新增资料投喂批次</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              当前优先支持文本粘贴与轻量文件读取。系统会先按规则拆解出候选知识，再提示疑似相似知识，最后由人工决定是采纳、合并还是驳回。
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
                      创建人：{batch.createdBy.name} / {formatDateTime(batch.createdAt)}
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

          {candidateViews.length ? (
            candidateViews.map((candidate) => (
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
                      {candidate.mergeAction ? (
                        <span className="rounded-md bg-amber-50 px-2.5 py-1 text-amber-700">
                          {mergeActionLabels.get(candidate.mergeAction as never) ?? candidate.mergeAction}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-slate-950">{candidate.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      来源批次：{candidate.batch.title} / 创建人：{candidate.createdBy.name}
                    </p>
                  </div>
                  {candidate.adoptedKnowledgeItemId ? (
                    <span className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                      已关联知识条目
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{candidate.content}</p>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <CandidatePanel title="建议关键词" value={parseMarketClawTextArray(candidate.suggestedKeywords).join("\n")} />
                  <CandidatePanel title="建议不能承诺事项" value={parseMarketClawTextArray(candidate.suggestedForbiddenPhrases).join("\n")} />
                  <CandidatePanel title="风险提醒" value={candidate.suggestedRiskNotes} />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <CandidatePanel title="简短微信版" value={candidate.suggestedReplyShort} rows={5} />
                  <CandidatePanel title="专业说明版" value={candidate.suggestedReplyProfessional} rows={5} />
                  <CandidatePanel title="推进成交版" value={candidate.suggestedReplyClosing} rows={5} />
                </div>

                <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">疑似相似知识</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        相似提示只用于辅助审核，不会阻断主流程。你仍然可以采纳为新知识，也可以合并、追加或直接驳回。
                      </p>
                    </div>
                    <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                      命中 {candidate.similarKnowledgeItems.length} 条
                    </span>
                  </div>

                  {candidate.similarKnowledgeItems.length ? (
                    <div className="mt-4 space-y-4">
                      {candidate.similarKnowledgeItems.map((item) => (
                        <SimilarKnowledgePanel
                          key={`${candidate.id}-${item.id}`}
                          tenantSlug={tenant.slug}
                          candidate={{
                            id: candidate.id,
                            title: candidate.title,
                            content: candidate.content,
                            mergeReason: candidate.mergeReason
                          }}
                          targetKnowledgeItem={item}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">当前没有命中明显相似的正式知识。若你判断这条候选仍应并入已有知识，可以在下方手动选择目标知识。</p>
                  )}
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  <form action={adoptMarketClawKnowledgeCandidate.bind(null, tenant.slug, candidate.id)} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-950">采纳为新知识</h3>
                    <Input label="知识标题" name="title" defaultValue={candidate.title} />
                    <Select label="知识类型" name="knowledgeType" options={marketClawKnowledgeTypeOptions} defaultValue={candidate.knowledgeType} />
                    <Select
                      label="采纳层级"
                      name="scopeLevel"
                      options={marketClawKnowledgeScopeOptions.filter((item) => ["ENTERPRISE", "DEPARTMENT", "BUSINESS_LINE"].includes(item.value))}
                      defaultValue={candidate.suggestedScopeLevel}
                    />
                    <Textarea label="知识正文" name="content" defaultValue={candidate.content} rows={6} />
                    <Textarea label="建议关键词" name="keywords" defaultValue={parseMarketClawTextArray(candidate.suggestedKeywords).join("\n")} rows={3} />
                    <Textarea
                      label="不能承诺事项"
                      name="forbiddenPhrases"
                      defaultValue={parseMarketClawTextArray(candidate.suggestedForbiddenPhrases).join("\n")}
                      rows={3}
                    />
                    <Textarea label="风险提醒" name="riskNotes" defaultValue={candidate.suggestedRiskNotes ?? ""} rows={3} />
                    <Textarea label="审核备注" name="reviewComment" defaultValue="" rows={2} />
                    <SubmitButton>采纳为新知识</SubmitButton>
                  </form>

                  <form action={mergeMarketClawKnowledgeCandidate.bind(null, tenant.slug, candidate.id)} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-950">手动选择目标知识</h3>
                    <Select
                      label="目标知识"
                      name="targetKnowledgeItemId"
                      options={[{ value: "", label: "请选择已有知识" }, ...knowledgeOptions]}
                    />
                    <Select
                      label="处理方式"
                      name="mergeAction"
                      options={marketClawKnowledgeCandidateMergeActionOptions.filter((item) =>
                        ["MERGE_INTO_EXISTING", "APPEND_TO_EXISTING"].includes(item.value)
                      )}
                      defaultValue="MERGE_INTO_EXISTING"
                    />
                    <Textarea label="合并后正文" name="mergedContent" defaultValue={candidate.content} rows={8} />
                    <Textarea
                      label="合并原因"
                      name="mergeReason"
                      defaultValue={candidate.mergeReason ?? "人工判断候选知识应并入已有知识，避免知识库口径分散。"}
                      rows={3}
                    />
                    <SubmitButton>确认合并/追加</SubmitButton>
                  </form>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <form action={rejectMarketClawKnowledgeCandidate.bind(null, tenant.slug, candidate.id)} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-950">标记为重复并驳回</h3>
                    <input name="reviewStatus" type="hidden" value="REJECTED" />
                    <input name="mergeAction" type="hidden" value="REJECT_AS_DUPLICATE" />
                    <Select
                      label="重复目标知识（可选）"
                      name="targetKnowledgeItemId"
                      options={[{ value: "", label: "仅记录重复原因" }, ...knowledgeOptions]}
                    />
                    <Textarea
                      label="重复原因"
                      name="reviewComment"
                      defaultValue="与已有知识口径重复，本轮不再新增独立条目。"
                      rows={4}
                    />
                    <SubmitButton>重复驳回</SubmitButton>
                  </form>

                  <form action={rejectMarketClawKnowledgeCandidate.bind(null, tenant.slug, candidate.id)} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-950">普通驳回</h3>
                    <input name="reviewStatus" type="hidden" value="REJECTED" />
                    <Textarea label="驳回原因" name="reviewComment" rows={4} />
                    <SubmitButton>驳回</SubmitButton>
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
