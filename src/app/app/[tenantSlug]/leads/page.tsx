/*
 * 文件说明：该文件实现客户线索列表页面。
 * 功能说明：按 tenantId 查询本企业线索，并支持来源、客户类型、需求、意向和阶段筛选。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：筛选解析
 *   第三部分：线索列表页面
 */
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageShell } from "@/components/Shell";
import { Card, Select, SubmitButton } from "@/components/Ui";
import { canViewAllTenantLeads, requireTenantAccess } from "@/lib/auth";
import { customerTypeOptions, formatDate, intentionOptions, labelOf, needTypeOptions, sourceOptions, stageOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ params, searchParams }: { params: { tenantSlug: string }; searchParams: Record<string, string | undefined> }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const where: Prisma.LeadWhereInput = { tenantId: tenant.id };
  if (!canViewAllTenantLeads(user.role)) {
    where.ownerId = user.id;
  }

  if (searchParams.source) where.source = searchParams.source as Prisma.EnumLeadSourceFilter["equals"];
  if (searchParams.customerType) where.customerType = searchParams.customerType as Prisma.EnumCustomerTypeFilter["equals"];
  if (searchParams.needType) where.needType = searchParams.needType as Prisma.EnumNeedTypeFilter["equals"];
  if (searchParams.intentionLevel) where.intentionLevel = searchParams.intentionLevel as Prisma.EnumIntentionLevelFilter["equals"];
  if (searchParams.stage) where.stage = searchParams.stage as Prisma.EnumLeadStageFilter["equals"];

  const leads = await prisma.lead.findMany({
    where,
    include: { owner: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <PageShell tenant={tenant} title="客户线索" description="线索列表只展示当前企业数据，后续真实登录会叠加角色权限。">
      <Card className="mb-5">
        <form className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Select label="来源" name="source" options={[{ value: "", label: "全部" }, ...sourceOptions]} defaultValue={searchParams.source} />
          <Select label="客户类型" name="customerType" options={[{ value: "", label: "全部" }, ...customerTypeOptions]} defaultValue={searchParams.customerType} />
          <Select label="需求类型" name="needType" options={[{ value: "", label: "全部" }, ...needTypeOptions]} defaultValue={searchParams.needType} />
          <Select label="意向等级" name="intentionLevel" options={[{ value: "", label: "全部" }, ...intentionOptions]} defaultValue={searchParams.intentionLevel} />
          <Select label="客户阶段" name="stage" options={[{ value: "", label: "全部" }, ...stageOptions]} defaultValue={searchParams.stage} />
          <div className="pt-6">
            <SubmitButton>筛选</SubmitButton>
          </div>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">客户</th>
                <th className="px-3 py-2">电话</th>
                <th className="px-3 py-2">来源</th>
                <th className="px-3 py-2">客户类型</th>
                <th className="px-3 py-2">需求</th>
                <th className="px-3 py-2">意向</th>
                <th className="px-3 py-2">阶段</th>
                <th className="px-3 py-2">负责人</th>
                <th className="px-3 py-2">下次跟进</th>
                <th className="px-3 py-2">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-slate-100">
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
                  <td className="px-3 py-3">{lead.owner?.name ?? "-"}</td>
                  <td className="px-3 py-3">{formatDate(lead.nextFollowAt)}</td>
                  <td className="px-3 py-3">{formatDate(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageShell>
  );
}
