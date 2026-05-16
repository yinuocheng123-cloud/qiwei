/*
 * 文件说明：该页面实现 V2.0.3 的客户管理总览页。
 * 功能说明：保留原有客户筛选与列表逻辑，并在页面顶部补充客户导入、来源归因、标签视图和表单线索的归类入口。
 *
 * 结构概览：
 *   第一部分：总览卡片与徽标组件
 *   第二部分：客户管理页数据查询
 *   第三部分：客户列表与归类区块
 */
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { bulkUpdateLeads } from "@/lib/actions";
import { canImportTenantLeads, canViewAllTenantLeads, requireTenantAccess } from "@/lib/auth";
import { customerTypeOptions, formatDate, intentionOptions, labelOf, needTypeOptions, sourceOptions, stageOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, StatCard, SubmitButton } from "@/components/Ui";

export const dynamic = "force-dynamic";

function CustomerEntryCard({
  title,
  description,
  href
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Card className="h-full">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <Link className="mt-4 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" href={href}>
        进入
      </Link>
    </Card>
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

export default async function LeadsPage({
  params,
  searchParams
}: {
  params: { tenantSlug: string };
  searchParams: Record<string, string | undefined>;
}) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const canViewAll = canViewAllTenantLeads(user.role);
  const canImport = canImportTenantLeads(user.role);
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

  const [leads, owners, recentSources, recentForms, recentImportBatches, tagRows] = await Promise.all([
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
    }),
    canViewAll
      ? prisma.leadSourceAttribution.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "desc" },
          take: 6
        })
      : Promise.resolve([]),
    canViewAll
      ? prisma.intakeForm.findMany({
          where: { tenantId: tenant.id },
          include: { createdLead: true },
          orderBy: { createdAt: "desc" },
          take: 6
        })
      : Promise.resolve([]),
    canImport
      ? prisma.importBatch.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "desc" },
          take: 4
        })
      : Promise.resolve([]),
    canViewAll
      ? prisma.leadTag.findMany({
          where: { tenantId: tenant.id },
          select: { tagName: true, tagGroup: true },
          orderBy: { createdAt: "desc" },
          take: 120
        })
      : Promise.resolve([])
  ]);

  const ownerOptions = [
    { value: "", label: "全部" },
    { value: "unassigned", label: "未分配" },
    ...owners.map((owner) => ({ value: owner.id, label: `${owner.name}（${owner.role}）` }))
  ];
  const now = new Date();
  const bulkAction = bulkUpdateLeads.bind(null, tenant.slug);
  const highIntentCount = leads.filter((lead) => lead.intentionLevel === "HIGH" || lead.intentionLevel === "STRONG").length;
  const overdueCount = leads.filter((lead) => Boolean(lead.nextFollowAt && lead.nextFollowAt < now)).length;
  const unassignedCount = leads.filter((lead) => !lead.ownerId).length;
  const topTags = Array.from(
    tagRows.reduce((map, row) => {
      const key = `${row.tagGroup}::${row.tagName}`;
      const current = map.get(key);
      map.set(key, { key, tagName: row.tagName, tagGroup: row.tagGroup, count: (current?.count ?? 0) + 1 });
      return map;
    }, new Map<string, { key: string; tagName: string; tagGroup: string; count: number }>())
      .values()
  )
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  return (
    <PageShell
      tenant={tenant}
      title="客户管理"
      description={
        canViewAll
          ? "把客户列表、客户导入、来源归因、标签视图和表单线索收口到同一入口，不再分散成多条一级导航。"
          : "销售侧只保留客户列表入口，并继续只看自己负责的客户。"
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={canViewAll ? "客户总数" : "我的客户"} value={leads.length} />
        <StatCard label="高意向客户" value={highIntentCount} />
        <StatCard label="逾期跟进" value={overdueCount} />
        <StatCard label="未分配客户" value={canViewAll ? unassignedCount : 0} />
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-950">客户管理入口</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">一级导航只保留“客户管理”，具体能力在页面内部继续分流。</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CustomerEntryCard title="客户列表" description="查看客户、筛选负责人、判断阶段并进入客户详情继续跟进。" href="#lead-table" />
          {canImport ? (
            <CustomerEntryCard title="客户导入" description="批量导入历史客户、活动名单和表单线索，统一进入系统跟进。" href={`/app/${tenant.slug}/imports`} />
          ) : null}
          {canViewAll ? (
            <CustomerEntryCard title="来源归因" description="回看客户到底从哪个渠道、活动、场景和页面进入系统。" href="#source-attribution" />
          ) : null}
          {canViewAll ? (
            <CustomerEntryCard title="标签视图" description="按标签和分组回看当前客户结构，辅助运营和销售复盘。" href="#tag-view" />
          ) : null}
          {canViewAll ? (
            <CustomerEntryCard title="表单线索" description="回看公开表单流入的线索，以及它们转成客户的承接情况。" href="#form-leads" />
          ) : null}
        </div>
      </section>

      <section id="lead-table" className="mt-6">
        <Card>
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
      </section>

      <Card className="mt-5">
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

      {canViewAll ? (
        <section id="source-attribution" className="mt-6">
          <h2 className="text-lg font-semibold text-slate-950">来源归因</h2>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {recentSources.length ? (
              recentSources.map((item) => (
                <Card key={item.id}>
                  <p className="text-sm font-medium text-slate-900">{item.sourceProject || item.sourceChannel || "未命名来源"}</p>
                  <p className="mt-2 text-sm text-slate-600">活动：{item.sourceCampaign || "未填写"}</p>
                  <p className="mt-1 text-sm text-slate-600">场景：{item.sourceScene || "未填写"}</p>
                  <p className="mt-1 text-sm text-slate-600">页面：{item.sourcePage || "未填写"}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                </Card>
              ))
            ) : (
              <EmptyStateCard text="当前还没有来源归因记录。" />
            )}
          </div>
        </section>
      ) : null}

      {canViewAll ? (
        <section id="tag-view" className="mt-6">
          <h2 className="text-lg font-semibold text-slate-950">标签视图</h2>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <p className="text-sm text-slate-600">这里先用轻量摘要承接标签视图，不强行把完整标签管理拆成新的一级导航。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {topTags.length ? (
                  topTags.map((tag) => (
                    <span key={tag.key} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                      {tag.tagName} · {tag.count}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">当前还没有标签数据。</p>
                )}
              </div>
            </Card>

            {canImport ? (
              <Card>
                <p className="text-sm font-medium text-slate-900">最近导入批次</p>
                <div className="mt-4 space-y-3">
                  {recentImportBatches.length ? (
                    recentImportBatches.map((batch) => (
                      <div key={batch.id} className="rounded-md border border-slate-200 p-3 text-sm">
                        <p className="font-medium text-slate-900">{batch.fileName}</p>
                        <p className="mt-1 text-slate-600">
                          状态：{batch.status} / 成功：{batch.successRows} / 重复：{batch.duplicateRows}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(batch.createdAt)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">当前还没有导入批次。</p>
                  )}
                </div>
              </Card>
            ) : null}
          </div>
        </section>
      ) : null}

      {canViewAll ? (
        <section id="form-leads" className="mt-6">
          <h2 className="text-lg font-semibold text-slate-950">表单线索</h2>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {recentForms.length ? (
              recentForms.map((form) => (
                <Card key={form.id}>
                  <p className="text-sm font-medium text-slate-900">{form.name}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    表单类型：{form.formType} / 来源：{labelOf(sourceOptions, form.source)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">客户类型：{labelOf(customerTypeOptions, form.customerType)}</p>
                  <p className="mt-1 text-sm text-slate-600">创建时间：{formatDate(form.createdAt)}</p>
                  {form.createdLead ? (
                    <Link className="mt-3 inline-flex text-sm font-medium text-emerald-700" href={`/app/${tenant.slug}/leads/${form.createdLead.id}`}>
                      查看转化后的客户
                    </Link>
                  ) : null}
                </Card>
              ))
            ) : (
              <EmptyStateCard text="当前还没有表单线索记录。" />
            )}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}

function EmptyStateCard({ text }: { text: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{text}</p>
    </Card>
  );
}
