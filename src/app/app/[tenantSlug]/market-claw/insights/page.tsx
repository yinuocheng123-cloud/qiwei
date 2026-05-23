/*
 * 文件说明：该页面实现 V2.0.8 的 Market Claw 训练复盘与知识治理入口。
 * 功能说明：基于现有训练、回复、资料投喂和知识库数据，提供轻量复盘、知识缺口提醒与企业阶段建议。
 *
 * 结构概览：
 *   第一部分：导入依赖与展示辅助函数
 *   第二部分：训练复盘页面
 *   第三部分：列表与空状态组件
 */
import { canAccessMarketClawInsights, requireTenantAccess } from "@/lib/auth";
import { getMarketClawTrainingInsights } from "@/lib/market-claw";
import { PageShell } from "@/components/Shell";
import { Callout, Card, SectionTabs, StatCard } from "@/components/Ui";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{text}</p>
    </Card>
  );
}

type TrainingInsights = Awaited<ReturnType<typeof getMarketClawTrainingInsights>>;

function emptyInsights(role: string): TrainingInsights {
  return {
    roleView: role === "SALES" ? "PERSONAL" : "GLOBAL",
    summaryMetrics: {
      trainingTotal: 0,
      myTrainingCount: 0,
      pendingTrainingCount: 0,
      adoptedTrainingCount: 0,
      rejectedTrainingCount: 0,
      personalScriptCount: 0,
      ingestionBatchCount: 0,
      candidateCount: 0,
      adoptedCandidateCount: 0,
      mergedCandidateCount: 0,
      rejectedCandidateCount: 0,
      enterpriseKnowledgeCount: 0,
      teamKnowledgeCount: 0,
      businessLineKnowledgeCount: 0,
      personalKnowledgeCount: 0
    },
    frequentQuestions: [],
    riskQuestionStats: [],
    knowledgeGaps: [],
    adoptionStats: { recentAdoptions: [], topContributors: [] },
    mergeStats: { recentMerges: [], mostMergedKnowledgeItems: [], duplicateRejectedTypes: [] },
    maturityStage: null,
    personalReviewProgress: []
  };
}

export default async function MarketClawInsightsPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  if (!canAccessMarketClawInsights(user.role)) {
    redirect("/forbidden");
  }

  let insightsUnavailable = false;
  let insights: TrainingInsights;
  try {
    insights = await getMarketClawTrainingInsights({
      tenantId: tenant.id,
      role: user.role,
      userId: user.id
    });
  } catch {
    insights = emptyInsights(user.role);
    insightsUnavailable = true;
  }
  const isPersonalView = insights.roleView === "PERSONAL";

  const summaryCards = isPersonalView
    ? [
        { label: "我的训练数", value: insights.summaryMetrics.myTrainingCount },
        { label: "待审核训练数", value: insights.summaryMetrics.pendingTrainingCount },
        { label: "已采纳训练数", value: insights.summaryMetrics.adoptedTrainingCount },
        { label: "已驳回训练数", value: insights.summaryMetrics.rejectedTrainingCount },
        { label: "个人常用话术数", value: insights.summaryMetrics.personalKnowledgeCount }
      ]
    : [
        { label: "训练总数", value: insights.summaryMetrics.trainingTotal },
        { label: "我的训练数", value: insights.summaryMetrics.myTrainingCount },
        { label: "待审核训练数", value: insights.summaryMetrics.pendingTrainingCount },
        { label: "已采纳训练数", value: insights.summaryMetrics.adoptedTrainingCount },
        { label: "已驳回训练数", value: insights.summaryMetrics.rejectedTrainingCount },
        { label: "个人常用话术数", value: insights.summaryMetrics.personalScriptCount },
        { label: "资料投喂批次数", value: insights.summaryMetrics.ingestionBatchCount },
        { label: "候选知识数", value: insights.summaryMetrics.candidateCount },
        { label: "已采纳候选数", value: insights.summaryMetrics.adoptedCandidateCount },
        { label: "已合并候选数", value: insights.summaryMetrics.mergedCandidateCount },
        { label: "已驳回候选数", value: insights.summaryMetrics.rejectedCandidateCount },
        { label: "企业标准知识数", value: insights.summaryMetrics.enterpriseKnowledgeCount },
        { label: "团队标准知识数", value: insights.summaryMetrics.teamKnowledgeCount },
        { label: "业务线知识数", value: insights.summaryMetrics.businessLineKnowledgeCount },
        { label: "个人话术数", value: insights.summaryMetrics.personalKnowledgeCount }
      ];

  return (
    <PageShell
      tenant={tenant}
      title={isPersonalView ? "Market Claw 我的训练表现" : "Market Claw 训练复盘"}
      breadcrumbs={[
        { label: "Market Claw", href: `/app/${tenant.slug}/market-claw` },
        { label: isPersonalView ? "我的训练表现" : "训练复盘" }
      ]}
      description={
        isPersonalView
          ? "这里只看你自己的训练、个人话术和审核进展，不展示全租户治理数据。"
          : "基于训练、资料投喂、候选知识与知识库的现有数据，做一页轻量、实用的训练复盘与知识治理，不做复杂 BI 大屏。"
      }
    >
      <SectionTabs current="insights" items={buildOverviewTabs(tenant.slug, user.role)} className="mb-6" />

      {insightsUnavailable ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          当前复盘数据暂不可用，不影响销售主流程。
        </div>
      ) : null}

      <Callout title={isPersonalView ? "个人视图说明" : "治理视图说明"} tone={isPersonalView ? "emerald" : "amber"}>
        {isPersonalView
          ? "销售在这里回看自己的训练表现、常见客户问题和审核结果。全员排行、企业阶段判断和知识缺口治理仍只对管理员与运营开放。"
          : "这页重点不是再堆功能，而是帮助企业看清高频问题、风险问题、知识缺口和采纳合并趋势，让知识库越用越清晰。"}
      </Callout>

      <section className="mt-6">
        <SectionTitle title="总览指标" description="先看当前训练、候选知识与知识库的基本盘，再决定下一步优先补哪块。" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <StatCard key={card.label} label={card.label} value={card.value} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle
          title={isPersonalView ? "我的高频客户问题" : "高频客户问题"}
          description={
            isPersonalView
              ? "这里优先回看你自己最近反复练到的问题，方便决定哪些问题要继续练、哪些要提交审核。"
              : "基于训练、回复、候选知识与已采纳知识做轻量主题归并，帮助你看清哪些客户问题正在反复出现。"
          }
        />
        <div className="space-y-3">
          {insights.frequentQuestions.length ? (
            insights.frequentQuestions.map((item) => (
              <Card key={`${item.topic}-${item.lastSeenAt.toISOString()}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-950">{item.topic}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      出现次数：{item.count} / 最近出现：{formatDateTime(item.lastSeenAt)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      涉及业务线：{item.businessLines.length ? item.businessLines.join("、") : "通用资料"}
                    </p>
                  </div>
                  <div className="text-sm text-right">
                    <p className={`font-medium ${item.hasStandardKnowledge ? "text-emerald-700" : "text-amber-700"}`}>
                      {item.hasStandardKnowledge ? "已有标准知识" : "建议补充知识"}
                    </p>
                    <p className="mt-2 max-w-sm text-slate-600">{item.suggestedAction}</p>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState text={isPersonalView ? "你还没有足够的训练和回复记录，先在“我的训练”里跑几轮真实客户问题。" : "当前还没有足够的训练与回复数据，先让训练、资料投喂和候选审核跑起来。"} />
          )}
        </div>
      </section>

      {isPersonalView ? (
        <section className="mt-8">
          <SectionTitle title="我的训练采纳情况" description="这里只看你自己的训练审核结果，方便判断哪些话术值得继续打磨或提交复审。" />
          <div className="space-y-3">
            {insights.personalReviewProgress.length ? (
              insights.personalReviewProgress.map((item) => (
                <Card key={`${item.question}-${item.updatedAt.toISOString()}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{item.question}</p>
                      <p className="mt-2 text-sm text-slate-600">当前状态：{item.reviewStatus}</p>
                      <p className="mt-1 text-sm text-slate-600">最近更新时间：{formatDateTime(item.updatedAt)}</p>
                    </div>
                    <div className="max-w-md text-sm text-slate-600">
                      <p>审核意见：{item.reviewComment ?? "暂未填写"}</p>
                      <p className="mt-1">已沉淀层级：{item.promotedScope ?? "尚未升级为正式知识"}</p>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <EmptyState text="你还没有可复盘的个人训练审核记录，先保存个人话术或提交一条训练结果审核。" />
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="mt-8">
            <SectionTitle
              title="风险问题复盘"
              description="先看价格、效果、周期、服务边界等高风险问题是否被反复提到，再决定是补边界、补风险提醒，还是补标准回复。"
            />
            <div className="space-y-3">
              {insights.riskQuestionStats.length ? (
                insights.riskQuestionStats.map((item) => (
                  <Card key={item.riskType}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-950">{item.riskType}</p>
                        <p className="mt-2 text-sm text-slate-600">出现次数：{item.count}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          涉及业务线：{item.businessLines.length ? item.businessLines.join("、") : "通用资料"}
                        </p>
                      </div>
                      <div className="max-w-md text-sm text-slate-600">
                        <p>已有风险提醒：{item.hasRiskNotice ? "是" : "否"}</p>
                        <p className="mt-1">已有不能承诺事项：{item.hasForbiddenCommitment ? "是" : "否"}</p>
                        <p className="mt-2">{item.suggestedAction}</p>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <EmptyState text="当前没有集中命中的风险问题复盘结果，说明风险问题样本还不够多，或当前边界已比较稳定。" />
              )}
            </div>
          </section>

          <section className="mt-8">
            <SectionTitle
              title="知识缺口提醒"
              description="重点看哪些业务线训练多、候选多、风险多，但正式知识、价格边界或团队标准还不够。"
            />
            <div className="space-y-3">
              {insights.knowledgeGaps.length ? (
                insights.knowledgeGaps.map((item, index) => (
                  <Card key={`${item.businessLine}-${item.gapType}-${index}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-950">{item.businessLine}</p>
                        <p className="mt-2 text-sm text-slate-600">缺口类型：{item.gapType}</p>
                        <p className="mt-1 text-sm text-slate-600">当前情况：{item.currentSnapshot}</p>
                      </div>
                      <div className="max-w-md text-sm text-slate-600">
                        <p>建议补充：{item.suggestedContent}</p>
                        <p className="mt-1">下一步动作：{item.nextAction}</p>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <EmptyState text="当前没有明显知识缺口提醒。可以继续观察高频问题和候选知识质量，再决定下一步治理重点。" />
              )}
            </div>
          </section>

          <section className="mt-8">
            <SectionTitle
              title="采纳与合并复盘"
              description="这里重点回看最近哪些候选知识被采纳或合并、哪些知识被反复强化，以及哪些销售贡献了高价值话术。"
            />
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <h3 className="text-base font-semibold text-slate-950">最近采纳的候选知识</h3>
                <div className="mt-4 space-y-3">
                  {insights.adoptionStats.recentAdoptions.length ? (
                    insights.adoptionStats.recentAdoptions.map((item) => (
                      <div key={`${item.title}-${item.occurredAt.toISOString()}`} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                        <p className="font-medium text-slate-950">{item.title}</p>
                        <p className="mt-2 text-sm text-slate-600">
                          {item.businessLine} / {item.knowledgeType}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.reviewStatus} / 处理人：{item.operatorName}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">当前还没有最近采纳记录。</p>
                  )}
                </div>
              </Card>

              <Card>
                <h3 className="text-base font-semibold text-slate-950">最近合并的候选知识</h3>
                <div className="mt-4 space-y-3">
                  {insights.mergeStats.recentMerges.length ? (
                    insights.mergeStats.recentMerges.map((item) => (
                      <div key={`${item.title}-${item.occurredAt.toISOString()}`} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                        <p className="font-medium text-slate-950">{item.title}</p>
                        <p className="mt-2 text-sm text-slate-600">
                          {item.businessLine} / {item.knowledgeType}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.reviewStatus} / 处理人：{item.operatorName}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">当前还没有最近合并记录。</p>
                  )}
                </div>
              </Card>

              <Card>
                <h3 className="text-base font-semibold text-slate-950">高价值话术贡献</h3>
                <div className="mt-4 space-y-3">
                  {insights.adoptionStats.topContributors.length ? (
                    insights.adoptionStats.topContributors.map((item) => (
                      <div key={`${item.userName}-${item.latestAt.toISOString()}`} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                        <p className="font-medium text-slate-950">{item.userName}</p>
                        <p className="mt-2 text-sm text-slate-600">采纳贡献：{item.adoptedCount} 条</p>
                        <p className="mt-1 text-sm text-slate-600">最近采纳：{formatDateTime(item.latestAt)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">当前还没有形成明显的高价值话术贡献分布。</p>
                  )}
                </div>
              </Card>

              <Card>
                <h3 className="text-base font-semibold text-slate-950">知识来源与重复治理</h3>
                <div className="mt-4 space-y-3">
                  {insights.mergeStats.mostMergedKnowledgeItems.length ? (
                    insights.mergeStats.mostMergedKnowledgeItems.map((item) => (
                      <div key={`${item.title}-${item.sourceCandidateCount}`} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                        <p className="font-medium text-slate-950">{item.title}</p>
                        <p className="mt-2 text-sm text-slate-600">
                          {item.businessLine} / 来源候选 {item.sourceCandidateCount} 条 / 来源批次 {item.sourceBatchCount} 批
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          最近合并时间：{item.lastMergedAt ? formatDateTime(item.lastMergedAt) : "暂未记录"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">当前还没有明显的多候选合并知识。</p>
                  )}

                  {insights.mergeStats.duplicateRejectedTypes.length ? (
                    <div className="rounded-md border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-950">重复驳回较多的候选类型</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {insights.mergeStats.duplicateRejectedTypes.map((item) => (
                          <span key={item.knowledgeType} className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            {item.knowledgeType} {item.count} 条
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>
          </section>

          <section className="mt-8">
            <SectionTitle
              title="企业阶段适配建议"
              description="不同企业的知识成熟度不同，系统会根据现有训练、候选和知识沉淀情况，给出更适合当前阶段的治理重点。"
            />
            {insights.maturityStage ? (
              <Card>
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">当前知识成熟度阶段</p>
                <h3 className="mt-3 text-2xl font-semibold text-slate-950">{insights.maturityStage.stage}</h3>
                <div className="mt-4 grid gap-6 xl:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">系统判断依据</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                      {insights.maturityStage.rationale.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">建议下一步</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                      {insights.maturityStage.nextActions.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            ) : (
              <EmptyState text="当前没有可展示的企业阶段判断。" />
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}
