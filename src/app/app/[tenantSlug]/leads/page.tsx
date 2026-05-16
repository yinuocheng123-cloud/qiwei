/*
 * 文件说明：该文件实现客户线索列表页面。
 * 功能说明：按 tenantId 查询本企业线索，并支持来源、客户类型、意向、阶段、负责人和未分配筛选。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：筛选条件构建
 *   第三部分：线索列表页面
 */
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { bulkUpdateLeads } from "@/lib/actions";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, SubmitButton } from "@/components/Ui";
import { canViewAllTenantLeads, requireTenantAccess } from "@/lib/auth";
import { customerTypeOptions, formatDate, intentionOptions, labelOf, needTypeOptions, sourceOptions, stageOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ params, searchParams }: { params: { tenantSlug: string }; searchParams: Record<string, string | undefined> }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const canViewAll = canViewAllTenantLeads(user.role);
  const where: Prisma.LeadWhereInput = { tenantId: tenant.id };
  const sourceAttributionFilter: Prisma.LeadSourceAttributionWhereInput = {};

  if (!canViewAll) {
    where.ownerId = user.id;
  } else if (searchParams.ownerId === "unassigned") {
    where.ownerId = null;
  } else if (searchParams.ownerId) {
    where.ownerId = searchParams.ownerId;
  }

  if (searchParams.source) where.source = searchParams.source as Prisma.EnumLeadSourceFilter["equals"];
  if (searchParams.customerType) where.customerType = searchParams.customerType as Prisma.EnumCustomerTypeFilter["equals"];
  if (searchParams.needType) where.needType = searchParams.needType as Prisma.EnumNeedTypeFilter["equals"];
  if (searchParams.intentionLevel) where.intentionLevel = searchParams.intentionLevel as Prisma.EnumIntentionLevelFilter["equals"];
  if (searchParams.stage) where.stage = searchParams.stage as Prisma.EnumLeadStageFilter["equals"];
  if (searchParams.sourceProject) {
    sourceAttributionFilter.sourceProject = { contains: searchParams.sourceProject, mode: "insensitive" };
  }
  if (searchParams.sourceCampaign) {
    sourceAttributionFilter.sourceCampaign = { contains: searchParams.sourceCampaign, mode: "insensitive" };
  }
  if (searchParams.sourceScene) {
    sourceAttributionFilter.sourceScene = { contains: searchParams.sourceScene, mode: "insensitive" };
  }
  if (Object.keys(sourceAttributionFilter).length) {
    where.sourceAttribution = { is: sourceAttributionFilter };
  }

  const [leads, owners] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { owner: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        status: "active",
        role: { in: ["SALES", "OPERATOR"] }
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const ownerOptions = [
    { value: "", label: "全部" },
    { value: "unassigned", label: "未分配" },
    ...owners.map((owner) => ({ value: owner.id, label: `${owner.name}（${owner.role}）` }))
  ];
  const now = new Date();
  const bulkAction = bulkUpdateLeads.bind(null, tenant.slug);

  return (
    <PageShell tenant={tenant} title="客户线索" description="销售只能看到自己负责的客户；企业管理员和运营可以按负责人或未分配状态筛选。">
      <Card className="mb-5">
        <form className="grid gap-3 md:grid-cols-3 lg:grid-cols-9">
          <Select label="来源" name="source" options={[{ value: "", label: "全部" }, ...sourceOptions]} defaultValue={searchParams.source} />
          <Select label="客户类型" name="customerType" options={[{ value: "", label: "全部" }, ...customerTypeOptions]} defaultValue={searchParams.customerType} />
          <Select label="需求类型" name="needType" options={[{ value: "", label: "全部" }, ...needTypeOptions]} defaultValue={searchParams.needType} />
          <Select label="意向等级" name="intentionLevel" options={[{ value: "", label: "全部" }, ...intentionOptions]} defaultValue={searchParams.intentionLevel} />
          <Select label="客户阶段" name="stage" options={[{ value: "", label: "全部" }, ...stageOptions]} defaultValue={searchParams.stage} />
          <Input label="来源项目" name="sourceProject" defaultValue={searchParams.sourceProject} />
          <Input label="来源活动" name="sourceCampaign" defaultValue={searchParams.sourceCampaign} />
          <Input label="来源场景" name="sourceScene" defaultValue={searchParams.sourceScene} />
          {canViewAll ? <Select label="负责人" name="ownerId" options={ownerOptions} defaultValue={searchParams.ownerId} /> : null}
          <div className="pt-6">
            <SubmitButton>筛选</SubmitButton>
          </div>
        </form>
      </Card>

      <Card>
        <form action={bulkAction}>
          {canViewAll ? (
            <div className="mb-4 grid gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-3 lg:grid-cols-6">
              <Select
                label="批量操作"
                name="bulkAction"
                options={[
                  { value: "assign", label: "批量分配负责人" },
                  { value: "stage", label: "批量更新阶段" },
                  { value: "nextFollow", label: "批量设置下次跟进" },
                  { value: "tag", label: "批量添加标签" },
                  { value: "reactivate", label: "批量转入待激活" }
                ]}
              />
              <Select label="负责人" name="ownerId" options={ownerOptions} />
              <Select label="阶段" name="stage" options={stageOptions} />
              <Input label="下次跟进" name="nextFollowAt" type="datetime-local" />
              <Input label="标签" name="tagName" />
              <div className="pt-6">
                <SubmitButton>执行批量操作</SubmitButton>
              </div>
            </div>
          ) : null}
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {canViewAll ? <th className="px-3 py-2">选择</th> : null}
                <th className="px-3 py-2">客户</th>
                <th className="px-3 py-2">电话</th>
                <th className="px-3 py-2">来源</th>
                <th className="px-3 py-2">客户类型</th>
                <th className="px-3 py-2">需求</th>
                <th className="px-3 py-2">意向</th>
                <th className="px-3 py-2">阶段</th>
                <th className="px-3 py-2">负责人</th>
                <th className="px-3 py-2">下次跟进</th>
                <th className="px-3 py-2">提醒</th>
                <th className="px-3 py-2">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const overdue = lead.nextFollowAt ? lead.nextFollowAt < now : false;
                const highIntent = lead.intentionLevel === "HIGH" || lead.intentionLevel === "STRONG";
                return (
                  <tr key={lead.id} className="border-t border-slate-100">
                    {canViewAll ? (
                      <td className="px-3 py-3">
                        <input className="h-4 w-4" name="leadIds" type="checkbox" value={lead.id} aria-label={`选择 ${lead.name}`} />
                      </td>
                    ) : null}
                    <td className="px-3 py-3 font-medium">
                      <Link className="text-emerald-700" href={`/app/${tenant.slug}/leads/${lead.id}`}>
                        {lead.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{lead.phone}</td>
                    <td className="px-3 py-3">{labelOf(sourceOptions, lead.source)}</td>
                    <td className="px-3 py-3">{labelOf(customerTypeOptions, lead.customerType)}</td>
                    <td className="px-3 py-3">{labelOf(needTypeOptions, lead.needType)}</td>
                    <td className="px-3 py-3">{labelOf(intentionOptions, lead.intentionLevel)}</td>
                    <td className="px-3 py-3">{labelOf(stageOptions, lead.stage)}</td>
                    <td className="px-3 py-3">{lead.owner?.name ?? "未分配"}</td>
                    <td className="px-3 py-3">{formatDate(lead.nextFollowAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {overdue ? <Badge tone="red">超时</Badge> : null}
                        {highIntent ? <Badge tone="amber">高意向</Badge> : null}
                        {!lead.ownerId ? <Badge tone="slate">未分配</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">{formatDate(lead.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </form>
      </Card>
    </PageShell>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "red" | "amber" | "slate" }) {
  const className =
    tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";
  return <span className={`rounded-md px-2 py-1 text-xs ${className}`}>{children}</span>;
}
