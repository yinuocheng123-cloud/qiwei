/*
 * 文件说明：该文件实现 V2.0 麻虾回复记录页面。
 * 功能说明：用于企业管理员、运营和销售查看回复草稿、使用状态与反馈结果，复盘哪些回复更好用。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：回复记录页面
 */
import { canAccessMarketClawReplies, requireTenantAccess } from "@/lib/auth";
import { marketClawReplySourceScopeOptions } from "@/lib/market-claw";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Card, Input, SectionTabs, Select } from "@/components/Ui";

export const dynamic = "force-dynamic";

const useStatusOptions = [
  { value: "", label: "全部使用状态" },
  { value: "GENERATED", label: "已生成" },
  { value: "COPIED", label: "已复制" },
  { value: "SAVED_AS_FOLLOWUP", label: "已保存为跟进" },
  { value: "DISMISSED", label: "已弃用" }
];

const feedbackStatusOptions = [
  { value: "", label: "全部反馈" },
  { value: "USEFUL", label: "好用" },
  { value: "NEEDS_EDIT", label: "需要修改" },
  { value: "NOT_USEFUL", label: "不好用" },
  { value: "UNRATED", label: "未评价" }
];

export default async function MarketClawRepliesPage({
  params,
  searchParams
}: {
  params: { tenantSlug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  if (!canAccessMarketClawReplies(user.role)) {
    return null;
  }

  const useStatus = typeof searchParams?.useStatus === "string" ? searchParams.useStatus : "";
  const feedbackStatus = typeof searchParams?.feedbackStatus === "string" ? searchParams.feedbackStatus : "";
  const salesId = typeof searchParams?.salesId === "string" ? searchParams.salesId : "";
  const businessLineId = typeof searchParams?.businessLineId === "string" ? searchParams.businessLineId : "";
  const departmentName = typeof searchParams?.departmentName === "string" ? searchParams.departmentName : "";
  const sourceScope = typeof searchParams?.sourceScope === "string" ? searchParams.sourceScope : "";
  const submitted = typeof searchParams?.submitted === "string" ? searchParams.submitted : "";
  const adopted = typeof searchParams?.adopted === "string" ? searchParams.adopted : "";

  const [users, businessLines, drafts] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    }),
    prisma.businessLine.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.marketClawReplyDraft.findMany({
      where: {
        tenantId: tenant.id,
        ...(user.role === "SALES" ? { createdById: user.id } : {}),
        ...(salesId && user.role !== "SALES" ? { createdById: salesId } : {}),
        ...(businessLineId ? { businessLineId } : {}),
        ...(departmentName ? { departmentName: { contains: departmentName } } : {}),
        ...(sourceScope ? { sourceScope: sourceScope as never } : {}),
        ...(useStatus ? { useStatus: useStatus as never } : {}),
        ...(feedbackStatus ? { feedbackStatus: feedbackStatus as never } : {}),
        ...(submitted === "yes" ? { submittedForReviewAt: { not: null } } : {}),
        ...(submitted === "no" ? { submittedForReviewAt: null } : {}),
        ...(adopted === "yes"
          ? { trainingCase: { reviewStatus: { in: ["TEAM_APPROVED", "ENTERPRISE_APPROVED"] } } }
          : {}),
        ...(adopted === "no"
          ? {
              OR: [{ trainingCase: null }, { trainingCase: { reviewStatus: { notIn: ["TEAM_APPROVED", "ENTERPRISE_APPROVED"] } } }]
            }
          : {})
      },
      include: {
        lead: true,
        createdBy: true,
        businessLine: true,
        trainingCase: true,
        feedbacks: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    })
  ]);

  return (
    <PageShell
      tenant={tenant}
      title="Market Claw 回复记录"
      breadcrumbs={[
        { label: "Market Claw", href: `/app/${tenant.slug}/market-claw` },
        { label: "回复记录" }
      ]}
      description="用于企业管理员和运营复盘哪些回复好用、哪些问题频繁出现、哪些知识库需要优化。"
    >
      <SectionTabs
        current="replies"
        items={
          user.role === "SALES"
            ? [
                { key: "overview", label: "总览", href: `/app/${tenant.slug}/market-claw` },
                { key: "training", label: "我的训练", href: `/app/${tenant.slug}/market-claw/training` },
                { key: "insights", label: "我的训练表现", href: `/app/${tenant.slug}/market-claw/insights` },
                { key: "replies", label: "我的回复记录", href: `/app/${tenant.slug}/market-claw/replies` },
                { key: "leads", label: "去客户列表", href: `/app/${tenant.slug}/leads` }
              ]
            : [
                { key: "overview", label: "总览", href: `/app/${tenant.slug}/market-claw` },
                { key: "knowledge", label: "知识库", href: `/app/${tenant.slug}/market-claw/knowledge` },
                { key: "ingestion", label: "资料投喂", href: `/app/${tenant.slug}/market-claw/ingestion` },
                { key: "training", label: "回复训练场", href: `/app/${tenant.slug}/market-claw/training` },
                { key: "review", label: "训练审核", href: `/app/${tenant.slug}/market-claw/training/review` },
                { key: "insights", label: "训练复盘", href: `/app/${tenant.slug}/market-claw/insights` },
                { key: "replies", label: "回复记录", href: `/app/${tenant.slug}/market-claw/replies` }
              ]
        }
        className="mb-6"
      />

      <Card>
        <form className="grid gap-4 md:grid-cols-3 xl:grid-cols-8">
          <Select label="使用状态" name="useStatus" options={useStatusOptions} defaultValue={useStatus} />
          <Select label="反馈状态" name="feedbackStatus" options={feedbackStatusOptions} defaultValue={feedbackStatus} />
          <Select
            label="回复来源"
            name="sourceScope"
            options={[{ value: "", label: "全部来源" }, ...marketClawReplySourceScopeOptions]}
            defaultValue={sourceScope}
          />
          {user.role !== "SALES" ? (
            <Select
              label="销售人员"
              name="salesId"
              options={[{ value: "", label: "全部销售" }, ...users.map((item) => ({ value: item.id, label: `${item.name} / ${item.role}` }))]}
              defaultValue={salesId}
            />
          ) : null}
          <Select
            label="业务线"
            name="businessLineId"
            options={[{ value: "", label: "全部业务线" }, ...businessLines.map((item) => ({ value: item.id, label: item.name }))]}
            defaultValue={businessLineId}
          />
          <Input label="部门" name="departmentName" defaultValue={departmentName} />
          <Select
            label="是否提交审核"
            name="submitted"
            options={[
              { value: "", label: "全部" },
              { value: "yes", label: "已提交" },
              { value: "no", label: "未提交" }
            ]}
            defaultValue={submitted}
          />
          <Select
            label="是否被采纳"
            name="adopted"
            options={[
              { value: "", label: "全部" },
              { value: "yes", label: "已采纳" },
              { value: "no", label: "未采纳" }
            ]}
            defaultValue={adopted}
          />
          <div className="flex items-end">
            <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">筛选</button>
          </div>
        </form>
      </Card>

      <div className="mt-6 space-y-4">
        {drafts.length ? (
          drafts.map((draft) => (
            <Card key={draft.id}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 text-sm">
                <Info label="生成时间" value={new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(draft.createdAt))} />
                <Info label="客户" value={draft.lead.name} />
                <Info label="销售" value={draft.createdBy.name} />
                <Info label="业务线" value={draft.businessLine?.name ?? "未指定"} />
                <Info label="部门" value={draft.departmentName ?? "未指定"} />
                <Info label="回复来源" value={marketClawReplySourceScopeOptions.find((item) => item.value === draft.sourceScope)?.label ?? draft.sourceScope} />
                <Info label="选用回复类型" value={draft.selectedReplyType ?? "未选择"} />
                <Info label="是否复制" value={draft.useStatus === "COPIED" ? "是" : "否"} />
                <Info label="是否保存为跟进" value={draft.useStatus === "SAVED_AS_FOLLOWUP" ? "是" : "否"} />
                <Info label="是否标记好用" value={draft.feedbackStatus === "USEFUL" ? "是" : "否"} />
                <Info label="是否有销售修改版本" value={draft.finalReply ? "是" : "否"} />
                <Info label="是否提交审核" value={draft.submittedForReviewAt ? "是" : "否"} />
                <Info
                  label="是否被采纳"
                  value={draft.trainingCase && ["TEAM_APPROVED", "ENTERPRISE_APPROVED"].includes(draft.trainingCase.reviewStatus) ? "是" : "否"}
                />
                <Info label="使用状态" value={draft.useStatus} />
              </div>
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-medium text-slate-900">客户问题</p>
                <p className="mt-1">{draft.customerQuestion}</p>
              </div>
              {draft.trainingCase ? (
                <div className="mt-3 rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">关联训练样本</p>
                  <p className="mt-1">训练状态：{draft.trainingCase.reviewStatus}</p>
                  <p className="mt-1">审核意见：{draft.trainingCase.reviewComment ?? "-"}</p>
                </div>
              ) : null}
              {draft.feedbacks[0]?.feedbackNote ? (
                <div className="mt-3 rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">最近反馈</p>
                  <p className="mt-1">{draft.feedbacks[0].feedbackNote}</p>
                </div>
              ) : null}
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm text-slate-500">当前没有 Market Claw 回复记录。先在客户详情页生成一轮回复草稿，再回来复盘使用情况。</p>
          </Card>
        )}
      </div>
    </PageShell>
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
