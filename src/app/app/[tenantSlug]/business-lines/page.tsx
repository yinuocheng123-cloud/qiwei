/*
 * 文件说明：该页面实现 V2.0.3 的业务配置总览。
 * 功能说明：把产品总览、资料包、策略库、任务模板和配置入口收口到同一页面，避免业务线页面继续铺成长表单。
 *
 * 结构概览：
 *   第一部分：概览卡片组件
 *   第二部分：产品总览卡片组件
 *   第三部分：业务配置总览页
 */
import Link from "next/link";
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
import { PageShell } from "@/components/Shell";
import { BusinessLineForm, StatusActionButtons } from "@/components/BusinessLineEditor";
import { Card, StatCard } from "@/components/Ui";

export const dynamic = "force-dynamic";

type BusinessLineItem = Awaited<ReturnType<typeof prisma.businessLine.findMany>>[number];
type MaterialItem = Awaited<ReturnType<typeof prisma.material.findMany>>[number];
type TaskTemplateItem = Awaited<ReturnType<typeof prisma.taskTemplate.findMany>>[number];

function ConfigEntryCard({
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
  const maintenanceRole = canEdit ? (canArchive ? "企业管理员 / 运营维护" : "运营维护 / 可暂停") : "销售只读 / 仅看启用产品";

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
        <InfoLine label="推荐标签数量" value={`${countBusinessLineTags(businessLine)} 个`} />
        <InfoLine label="关联资料数量" value={`${countBusinessLineMaterials(businessLine)} 份`} />
        <InfoLine label="关联任务模板数量" value={`${countBusinessLineTaskTemplates(businessLine)} 个`} />
        <InfoLine label="优先级" value={String(businessLine.priority)} />
        <InfoLine label="最近更新时间" value={formatDate(businessLine.updatedAt)} />
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
        {canEdit ? (
          <StatusActionButtons
            tenantSlug={tenantSlug}
            businessLine={businessLine}
            canArchive={canArchive}
            action={updateBusinessLineStatus}
          />
        ) : null}
      </div>
    </Card>
  );
}

export default async function BusinessLinesPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const canEdit = user.role === "TENANT_ADMIN" || user.role === "OPERATOR";
  const canArchive = user.role === "TENANT_ADMIN";

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
      description={
        canEdit
          ? "把产品总览、资料包、策略库、任务模板、企微配置和合规配置收口到同一条维护路径，避免后台入口继续平铺。"
          : "销售侧只查看启用产品总览，用于理解当前主推方向、推荐标签、推荐资料和下一步动作。"
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="产品总数" value={businessLines.length} />
        <StatCard label="启用中" value={activeCount} />
        <StatCard label="暂停中" value={pausedCount} />
        <StatCard label="已归档" value={archivedCount} />
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-950">配置导航</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          先从产品总览进入，再按模块跳转到资料、策略、任务模板和配置页，不再把所有配置项都堆在左侧导航里。
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ConfigEntryCard
            title="产品总览"
            description="查看当前启用、暂停和归档中的产品，并进入产品详情做更细的维护。"
            href={`/app/${tenant.slug}/business-lines#product-overview`}
          />
          <ConfigEntryCard
            title="资料包"
            description="维护销售在客户详情页和 Market Claw 推荐中会用到的资料资产。"
            href={`/app/${tenant.slug}/materials`}
          />
          <ConfigEntryCard
            title="策略库"
            description="统一维护不同客户类型的话术、资料和推荐动作，不让销售各说各话。"
            href={`/app/${tenant.slug}/strategies`}
          />
          <ConfigEntryCard
            title="任务模板"
            description="维护跟进模板，保证今天该做什么、下一步做什么有一致节奏。"
            href={`/app/${tenant.slug}/task-templates`}
          />
          {user.role === "TENANT_ADMIN" ? (
            <ConfigEntryCard
              title="企微配置"
              description="保留高权限配置入口，不让普通角色直接接触敏感密钥和回调配置。"
              href={`/app/${tenant.slug}/wecom`}
            />
          ) : null}
          {canEdit ? (
            <ConfigEntryCard
              title="合规配置"
              description="围绕沟通素材采集边界做收口，继续保持不自动发送、不自动采集的原则。"
              href={`/app/${tenant.slug}/communication-compliance`}
            />
          ) : null}
        </div>
      </section>

      {canEdit ? (
        <details className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-base font-semibold text-slate-950">新增产品</summary>
          <p className="mt-3 text-sm leading-6 text-slate-600">新增入口保留在总览页，但默认折叠，避免产品总览一打开就是一长串字段。</p>
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">产品总览</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              每张产品卡片只展示核心信息，需要维护更多细节时再进入详情页，不再把全部字段铺成长页面。
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {businessLines.length ? (
            businessLines.map((businessLine) => (
              <BusinessLineOverviewCard
                key={businessLine.id}
                tenantSlug={tenant.slug}
                businessLine={businessLine}
                canEdit={canEdit}
                canArchive={canArchive}
              />
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
