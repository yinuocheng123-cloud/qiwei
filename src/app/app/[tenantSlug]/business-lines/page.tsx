/*
 * 文件说明：该页面实现业务配置总览。
 * 功能说明：把试点前的业务基础配置与低频系统基础配置分开展示，弱化 AI、企微和合规入口。
 *
 * 结构概览：
 *   第一部分：导入依赖与展示组件
 *   第二部分：产品总览卡片
 *   第三部分：业务配置页面
 */
import Link from "next/link";
import { BusinessLineForm, StatusActionButtons } from "@/components/BusinessLineEditor";
import { PageShell } from "@/components/Shell";
import { Callout, Card, ModuleMoreMenu, SectionTabs, StatCard } from "@/components/Ui";
import { createBusinessLine, updateBusinessLineStatus } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import {
  countBusinessLineMaterials,
  countBusinessLineTags,
  countBusinessLineTaskTemplates,
  parseBusinessLineCustomerTypes
} from "@/lib/business-lines";
import { businessLineCategoryOptions, businessLineStatusOptions, customerTypeOptions, formatDate, labelOf } from "@/lib/options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BusinessLineItem = Awaited<ReturnType<typeof prisma.businessLine.findMany>>[number];
type MaterialItem = Awaited<ReturnType<typeof prisma.material.findMany>>[number];
type TaskTemplateItem = Awaited<ReturnType<typeof prisma.taskTemplate.findMany>>[number];

function ConfigEntryCard({ title, description, href }: { title: string; description: string; href: string }) {
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}

function BusinessLineOverviewCard({
  tenantSlug,
  businessLine,
  canEdit,
  canArchive
}: {
  tenantSlug: string;
  businessLine: BusinessLineItem;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const customerTypes = parseBusinessLineCustomerTypes(businessLine.targetCustomerTypes);
  const statusLabel = labelOf(businessLineStatusOptions, businessLine.status);
  const categoryLabel = labelOf(businessLineCategoryOptions, businessLine.category);
  const maintenanceRole = canEdit ? (canArchive ? "管理员 / 运营维护" : "运营维护 / 可暂停") : "销售只读";

  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-emerald-700">{categoryLabel}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{businessLine.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{statusLabel}</p>
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-700">{maintenanceRole}</span>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <InfoLine label="适合客户类型" value={customerTypes.length ? `${customerTypes.length} 类` : "未限制"} />
        <InfoLine label="推荐标签" value={`${countBusinessLineTags(businessLine)} 个`} />
        <InfoLine label="关联资料" value={`${countBusinessLineMaterials(businessLine)} 份`} />
        <InfoLine label="任务模板" value={`${countBusinessLineTaskTemplates(businessLine)} 个`} />
        <InfoLine label="优先级" value={String(businessLine.priority)} />
        <InfoLine label="最近更新" value={formatDate(businessLine.updatedAt)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {customerTypes.length ? (
          customerTypes.map((item) => (
            <span key={item} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
              {labelOf(customerTypeOptions, item)}
            </span>
          ))
        ) : (
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">通用产品</span>
        )}
      </div>

      {businessLine.description ? <p className="mt-4 text-sm leading-6 text-slate-600">{businessLine.description}</p> : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white" href={`/app/${tenantSlug}/business-lines/${businessLine.id}`}>
          查看详情
        </Link>
        {canEdit ? <StatusActionButtons tenantSlug={tenantSlug} businessLine={businessLine} canArchive={canArchive} action={updateBusinessLineStatus} /> : null}
      </div>
    </Card>
  );
}

export default async function BusinessLinesPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const canEdit = user.role === "TENANT_ADMIN" || user.role === "OPERATOR";
  const canArchive = user.role === "TENANT_ADMIN";
  const base = `/app/${tenant.slug}`;

  const [businessLines, materials, taskTemplates] = await Promise.all([
    prisma.businessLine.findMany({
      where: {
        tenantId: tenant.id,
        ...(canEdit ? {} : { status: "ACTIVE" })
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.material.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ customerType: "asc" }, { createdAt: "desc" }]
    }),
    prisma.taskTemplate.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }]
    })
  ]);

  const createAction = createBusinessLine.bind(null, tenant.slug);
  const activeCount = businessLines.filter((item) => item.status === "ACTIVE").length;
  const pausedCount = businessLines.filter((item) => item.status === "PAUSED").length;
  const archivedCount = businessLines.filter((item) => item.status === "ARCHIVED").length;

  return (
    <PageShell
      tenant={tenant}
      title="业务配置"
      breadcrumbs={[
        { label: "业务配置", href: `${base}/business-lines` },
        { label: "产品总览" }
      ]}
      description={
        canEdit
          ? "业务基础用于试点前配置产品和资料；系统基础配置属于低频设置，不建议试点演示时重点讲。"
          : "销售侧只查看启用产品，用于理解当前主推方向、资料建议和下一步动作。"
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="产品总数" value={businessLines.length} />
        <StatCard label="启用中" value={activeCount} />
        <StatCard label="暂停中" value={pausedCount} />
        <StatCard label="已归档" value={archivedCount} />
      </div>

      <SectionTabs
        current="overview"
        items={[
          { key: "overview", label: "产品总览", href: `${base}/business-lines#product-overview` },
          { key: "materials", label: "资料包", href: `${base}/materials` },
          { key: "strategies", label: "策略库", href: `${base}/strategies` },
          { key: "tasks", label: "任务模板", href: `${base}/task-templates` }
        ]}
        className="mt-4"
      />

      <Callout className="mt-4" title={canEdit ? "试点前配置顺序" : "销售查看路径"} tone={canEdit ? "slate" : "emerald"}>
        {canEdit
          ? "先维护产品总览、资料包、策略库和任务模板。AI 能力、企业微信提醒和合规配置属于低频系统基础配置，试点演示时只做必要说明。"
          : "先看产品总览确认主推产品，再回到客户详情页结合资料建议和 Market Claw 回复建议实际使用。"}
      </Callout>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-950">业务基础</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">用于试点前配置产品、资料、策略和跟进节奏，是客户导入和销售跟进的基础。</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ConfigEntryCard title="产品总览" description="查看当前启用、暂停和归档中的产品，并进入详情维护适配客户、标签和 SOP。" href={`${base}/business-lines#product-overview`} />
          <ConfigEntryCard title="资料包" description="维护销售在客户详情页和 Market Claw 推荐中会用到的资料资产。" href={`${base}/materials`} />
          <ConfigEntryCard title="策略库" description="维护不同客户类型的资料、话术和推荐动作。" href={`${base}/strategies`} />
          <ConfigEntryCard title="任务模板" description="维护标准跟进动作，让今日跟进和下一步任务有一致节奏。" href={`${base}/task-templates`} />
        </div>
      </section>

      {canEdit ? (
        <section className="mt-6">
          <details className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-base font-semibold text-slate-950">系统基础配置</summary>
            <p className="mt-3 text-sm leading-6 text-slate-600">这些属于低频设置，不建议熟客试点第一次演示时重点展开。</p>
            <div className="mt-4">
              <ModuleMoreMenu
                label="打开更多设置"
                items={[
                  { title: "AI 能力配置", href: `${base}/ai-settings`, description: "配置和测试内部回复能力。" },
                  ...(user.role === "TENANT_ADMIN"
                    ? [{ title: "企业微信提醒配置", href: `${base}/wecom`, description: "配置内部工作提醒和成员绑定。" }]
                    : []),
                  { title: "合规配置", href: `${base}/communication-compliance`, description: "维护沟通素材采集和使用边界。" }
                ]}
              />
            </div>
          </details>
        </section>
      ) : null}

      {canEdit ? (
        <details className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-base font-semibold text-slate-950">新增产品</summary>
          <p className="mt-3 text-sm leading-6 text-slate-600">新增入口默认折叠，避免产品总览一打开就变成维护表单。</p>
          <div className="mt-4">
            <BusinessLineForm
              action={createAction}
              submitText="新增产品"
              materials={materials as MaterialItem[]}
              taskTemplates={taskTemplates as TaskTemplateItem[]}
              canArchive={canArchive}
            />
          </div>
        </details>
      ) : null}

      <section id="product-overview" className="mt-6">
        <h2 className="text-lg font-semibold text-slate-950">产品总览</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">每张产品卡片只展示核心状态，更多字段进入产品详情页维护。</p>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {businessLines.length ? (
            businessLines.map((businessLine) => (
              <BusinessLineOverviewCard key={businessLine.id} tenantSlug={tenant.slug} businessLine={businessLine} canEdit={canEdit} canArchive={canArchive} />
            ))
          ) : (
            <Card>
              <p className="text-sm text-slate-500">{canEdit ? "当前还没有产品，先新增一个产品卡片。" : "当前没有可查看的启用产品。"}</p>
            </Card>
          )}
        </div>
      </section>
    </PageShell>
  );
}
