/*
 * 文件说明：该页面实现 V2.2 的 AI 推荐回复收口页。
 * 功能说明：销售侧只看到“AI 推荐回复”心智，后台知识、训练、沙盒和治理入口转入系统设置。
 *
 * 结构概览：
 *   第一部分：导入依赖与展示组件
 *   第二部分：角色化数据查询
 *   第三部分：AI 推荐回复页面渲染
 */
import Link from "next/link";
import { PageShell } from "@/components/Shell";
import { Card, Callout, ModuleMoreMenu, StatCard } from "@/components/Ui";
import { requireTenantAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function StepCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="h-full">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </Card>
  );
}

async function safeGovernanceRead<T>(read: () => Promise<T>, fallback: T): Promise<{ data: T; unavailable: boolean }> {
  try {
    return { data: await read(), unavailable: false };
  } catch {
    return { data: fallback, unavailable: true };
  }
}

export default async function MarketClawPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const base = `/app/${tenant.slug}`;
  const isSales = user.role === "SALES";
  const ownerFilter = isSales ? { createdById: user.id } : {};

  const [replyDraftCountResult, highRiskCountResult, recentDraftsResult] = await Promise.all([
    safeGovernanceRead<number>(() => prisma.marketClawReplyDraft.count({ where: { tenantId: tenant.id, ...ownerFilter } }), 0),
    safeGovernanceRead<number>(() => prisma.marketClawReplyDraft.count({ where: { tenantId: tenant.id, ...ownerFilter, replyRiskLevel: { in: ["HIGH", "BLOCKED"] } } }), 0),
    safeGovernanceRead(
      () =>
        prisma.marketClawReplyDraft.findMany({
          where: { tenantId: tenant.id, ...ownerFilter },
          include: { lead: true },
          orderBy: { createdAt: "desc" },
          take: 6
        }),
      []
    )
  ]);
  const replyDraftCount = replyDraftCountResult.data;
  const highRiskCount = highRiskCountResult.data;
  const recentDrafts = recentDraftsResult.data;
  const governanceDataUnavailable = replyDraftCountResult.unavailable || highRiskCountResult.unavailable || recentDraftsResult.unavailable;

  return (
    <PageShell
      tenant={tenant}
      title="AI 推荐回复"
      breadcrumbs={[
        { label: "工作台", href: `${base}/dashboard` },
        { label: "AI 推荐回复" }
      ]}
      description="Market Claw 是后台 AI 治理能力，不是销售日常入口；销售只在客户详情页看到 AI 推荐回复结果。"
    >
      <Callout title={isSales ? "销售使用方式" : "试点讲法"} tone={isSales ? "emerald" : "slate"}>
        {isSales
          ? "从今日待办进入客户详情，查看客户信息和最近沟通，再使用 AI 推荐回复。确认风险后，把最终沟通保存为跟进记录。"
          : "演示时只讲销售如何使用 AI 推荐回复。知识、训练、资料投喂、沙盒和审核都属于后台治理，不在销售主路径展开。"}
      </Callout>

      {governanceDataUnavailable ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          当前复盘数据暂不可用，不影响销售主流程。
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label={isSales ? "我的推荐回复" : "推荐回复记录"} value={replyDraftCount} />
        <StatCard label="高风险/仅内部建议" value={highRiskCount} />
        <StatCard label="下一步入口" value="客户详情" />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StepCard title="1. 打开客户详情" description="先看客户当前阶段、最近沟通和下一步跟进任务。" />
        <StepCard title="2. 查看 AI 推荐回复" description="系统给出建议回复和风险提醒，销售先判断是否适合发。" />
        <StepCard title="3. 人工确认后使用" description="高风险和仅内部建议不能直接发给客户，必须人工调整。" />
        <StepCard title="4. 保存沟通记录" description="把最终沟通和下一步动作保存到客户时间线，形成沉淀。" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <h2 className="text-base font-semibold text-slate-950">最近推荐回复</h2>
          <div className="mt-4 space-y-3">
            {recentDrafts.length ? (
              recentDrafts.map((draft) => (
                <Link key={draft.id} className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href={`${base}/leads/${draft.leadId}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-medium text-slate-950">{draft.lead.name}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{draft.replyRiskLevel}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{draft.customerQuestion}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">当前还没有推荐回复记录。请先从客户详情页生成一条建议。</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-slate-950">开始使用</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">AI 推荐回复不作为独立后台功能使用。它只服务客户详情页里的销售沟通。</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={`${base}/leads`}>
              进入客户列表
            </Link>
            <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href={`${base}/todos?view=today#today-tasks`}>
              查看今日待办
            </Link>
          </div>
        </Card>
      </section>

      {!isSales ? (
        <section className="mt-6">
          <details className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-base font-semibold text-slate-950">后台治理入口</summary>
            <p className="mt-3 text-sm leading-6 text-slate-600">这些入口只给管理员和运营维护，不进入销售学习路径。</p>
            <div className="mt-4">
              <ModuleMoreMenu
                label="打开后台治理"
                items={[
                  { title: "系统设置", href: `${base}/settings`, description: "统一进入 AI、企微、合规和审计设置。" },
                  { title: "知识维护", href: `${base}/market-claw/knowledge`, description: "维护 AI 推荐回复引用的知识。" },
                  { title: "资料投喂", href: `${base}/market-claw/ingestion`, description: "把资料整理成候选知识。" },
                  { title: "回复审核", href: `${base}/market-claw/training/review`, description: "审核销售沉淀的回复样本。" },
                  { title: "回复测试", href: `${base}/market-claw/sandbox`, description: "内部测试，不给销售日常使用。" }
                ]}
              />
            </div>
          </details>
        </section>
      ) : null}
    </PageShell>
  );
}
