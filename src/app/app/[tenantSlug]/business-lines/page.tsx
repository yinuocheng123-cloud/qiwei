/*
 * 文件说明：该页面实现 V1.7 业务线／产品管理。
 * 功能说明：统一管理租户当前对外推广、销售和服务的业务线、产品或项目，并关联资料包、任务模板和推荐标签。
 *
 * 结构概览：
 *   第一部分：导入依赖与基础选项
 *   第二部分：新增与编辑辅助组件
 *   第三部分：业务线／产品管理页面
 */
import { createBusinessLine, updateBusinessLine, updateBusinessLineStatus } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import {
  countBusinessLineMaterials,
  countBusinessLineTags,
  countBusinessLineTaskTemplates,
  parseBusinessLineCustomerTypes,
  parseBusinessLineIdList,
  parseBusinessLineRecommendedTags,
  stringifyBusinessLineRecommendedTags
} from "@/lib/business-lines";
import {
  businessLineCategoryOptions,
  businessLineStatusOptions,
  customerTypeOptions,
  formatDate,
  labelOf
} from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

type BusinessLineItem = Awaited<ReturnType<typeof prisma.businessLine.findMany>>[number];
type MaterialItem = Awaited<ReturnType<typeof prisma.material.findMany>>[number];
type TaskTemplateItem = Awaited<ReturnType<typeof prisma.taskTemplate.findMany>>[number];

function CheckboxGroup({
  title,
  name,
  options,
  selectedValues
}: {
  title: string;
  name: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input defaultChecked={selectedValues.includes(option.value)} name={name} type="checkbox" value={option.value} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function RelatedRecordCheckboxes({
  title,
  name,
  records,
  selectedIds,
  emptyText
}: {
  title: string;
  name: "recommendedMaterialIds" | "recommendedTaskTemplateIds";
  records: { id: string; title: string; subtitle?: string }[];
  selectedIds: string[];
  emptyText: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {records.length ? (
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
          {records.map((record) => (
            <label key={record.id} className="flex items-start gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-700">
              <input defaultChecked={selectedIds.includes(record.id)} name={name} type="checkbox" value={record.id} />
              <span>
                <span className="block font-medium text-slate-900">{record.title}</span>
                {record.subtitle ? <span className="block text-xs text-slate-500">{record.subtitle}</span> : null}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}

function BusinessLineForm({
  action,
  submitText,
  materials,
  taskTemplates,
  businessLine,
  canArchive
}: {
  action: (formData: FormData) => Promise<void>;
  submitText: string;
  materials: MaterialItem[];
  taskTemplates: TaskTemplateItem[];
  businessLine?: BusinessLineItem;
  canArchive: boolean;
}) {
  const selectedCustomerTypes = businessLine ? parseBusinessLineCustomerTypes(businessLine.targetCustomerTypes) : [];
  const selectedMaterialIds = businessLine ? parseBusinessLineIdList(businessLine.recommendedMaterialIds) : [];
  const selectedTaskTemplateIds = businessLine ? parseBusinessLineIdList(businessLine.recommendedTaskTemplateIds) : [];
  const recommendedTagText = businessLine
    ? stringifyBusinessLineRecommendedTags(parseBusinessLineRecommendedTags(businessLine.recommendedTagNames))
    : "";
  const availableStatusOptions = canArchive
    ? businessLineStatusOptions
    : businessLineStatusOptions.filter((option) => option.value !== "ARCHIVED");

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="名称" name="name" defaultValue={businessLine?.name} required />
        <Input label="Slug" name="slug" defaultValue={businessLine?.slug} />
        <Select label="分类" name="category" options={businessLineCategoryOptions} defaultValue={businessLine?.category ?? "OTHER"} />
        <Select label="状态" name="status" options={availableStatusOptions} defaultValue={businessLine?.status ?? "ACTIVE"} />
        <Input label="优先级" name="priority" type="number" defaultValue={String(businessLine?.priority ?? 100)} />
        <Input label="默认下一步动作" name="defaultNextAction" defaultValue={businessLine?.defaultNextAction ?? ""} />
      </div>

      <Textarea label="业务线说明" name="description" defaultValue={businessLine?.description ?? ""} rows={3} />

      <CheckboxGroup title="适合客户类型" name="targetCustomerTypes" options={customerTypeOptions} selectedValues={selectedCustomerTypes} />

      <Textarea
        label="推荐标签"
        name="recommendedTags"
        defaultValue={recommendedTagText}
        rows={4}
      />
      <p className="text-xs text-slate-500">每行使用“标签名称|标签分组”格式，例如：GEO意向|业务标签。</p>

      <RelatedRecordCheckboxes
        title="关联资料包"
        name="recommendedMaterialIds"
        records={materials.map((material) => ({
          id: material.id,
          title: material.title,
          subtitle: labelOf(customerTypeOptions, material.customerType ?? "") === ""
            ? "通用资料"
            : labelOf(customerTypeOptions, material.customerType ?? "")
        }))}
        selectedIds={selectedMaterialIds}
        emptyText="当前租户还没有资料包。"
      />

      <RelatedRecordCheckboxes
        title="关联任务模板"
        name="recommendedTaskTemplateIds"
        records={taskTemplates.map((template) => ({
          id: template.id,
          title: template.name,
          subtitle: template.title
        }))}
        selectedIds={selectedTaskTemplateIds}
        emptyText="当前租户还没有任务模板。"
      />

      <Textarea label="内部备注" name="notes" defaultValue={businessLine?.notes ?? ""} rows={3} />

      <SubmitButton>{submitText}</SubmitButton>
    </form>
  );
}

function StatusActionButtons({
  tenantSlug,
  businessLine,
  canArchive
}: {
  tenantSlug: string;
  businessLine: BusinessLineItem;
  canArchive: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {businessLine.status !== "ACTIVE" ? (
        <form action={updateBusinessLineStatus.bind(null, tenantSlug, businessLine.id, "ACTIVE")}>
          <button className="rounded-md border border-emerald-200 px-3 py-2 text-sm text-emerald-700">启用</button>
        </form>
      ) : null}
      {businessLine.status !== "PAUSED" ? (
        <form action={updateBusinessLineStatus.bind(null, tenantSlug, businessLine.id, "PAUSED")}>
          <button className="rounded-md border border-amber-200 px-3 py-2 text-sm text-amber-700">暂停</button>
        </form>
      ) : null}
      {canArchive && businessLine.status !== "ARCHIVED" ? (
        <form action={updateBusinessLineStatus.bind(null, tenantSlug, businessLine.id, "ARCHIVED")}>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">归档</button>
        </form>
      ) : null}
    </div>
  );
}

function BusinessLineReadonlyCard({
  businessLine,
  materialsById,
  taskTemplatesById
}: {
  businessLine: BusinessLineItem;
  materialsById: Map<string, MaterialItem>;
  taskTemplatesById: Map<string, TaskTemplateItem>;
}) {
  const customerTypes = parseBusinessLineCustomerTypes(businessLine.targetCustomerTypes);
  const tags = parseBusinessLineRecommendedTags(businessLine.recommendedTagNames);
  const materialIds = parseBusinessLineIdList(businessLine.recommendedMaterialIds);
  const taskTemplateIds = parseBusinessLineIdList(businessLine.recommendedTaskTemplateIds);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-emerald-700">{labelOf(businessLineCategoryOptions, businessLine.category)}</p>
          <h2 className="text-lg font-semibold text-slate-950">{businessLine.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{labelOf(businessLineStatusOptions, businessLine.status)}</p>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <p>优先级：{businessLine.priority}</p>
          <p className="mt-1">最后更新：{formatDate(businessLine.updatedAt)}</p>
        </div>
      </div>

      {businessLine.description ? <p className="mt-4 text-sm leading-6 text-slate-700">{businessLine.description}</p> : null}

      <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
        <div>
          <p className="font-medium text-slate-950">适合客户类型</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {customerTypes.length ? customerTypes.map((item) => <span key={item} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{labelOf(customerTypeOptions, item)}</span>) : <span className="text-slate-500">未限制客户类型</span>}
          </div>
        </div>

        <div>
          <p className="font-medium text-slate-950">推荐标签</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.length ? tags.map((tag) => <span key={`${tag.tagGroup}-${tag.tagName}`} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">{tag.tagName}</span>) : <span className="text-slate-500">未配置推荐标签</span>}
          </div>
        </div>

        <div>
          <p className="font-medium text-slate-950">关联资料包</p>
          <div className="mt-2 space-y-1">
            {materialIds.length ? materialIds.map((id) => <p key={id} className="text-slate-700">{materialsById.get(id)?.title ?? id}</p>) : <p className="text-slate-500">未绑定资料包</p>}
          </div>
        </div>

        <div>
          <p className="font-medium text-slate-950">关联任务模板</p>
          <div className="mt-2 space-y-1">
            {taskTemplateIds.length ? taskTemplateIds.map((id) => <p key={id} className="text-slate-700">{taskTemplatesById.get(id)?.name ?? id}</p>) : <p className="text-slate-500">未绑定任务模板</p>}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="font-medium text-slate-950">默认下一步动作</p>
          <p className="mt-1 text-slate-700">{businessLine.defaultNextAction ?? "未配置"}</p>
        </div>
        <div>
          <p className="font-medium text-slate-950">内部备注</p>
          <p className="mt-1 text-slate-700">{businessLine.notes ?? "未配置"}</p>
        </div>
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
  const materialsById = new Map(materials.map((material) => [material.id, material]));
  const taskTemplatesById = new Map(taskTemplates.map((template) => [template.id, template]));

  return (
    <PageShell
      tenant={tenant}
      title="业务线／产品管理"
      description={
        canEdit
          ? "用于管理企业当前对外推广、销售和服务的业务线、产品或项目。每条业务线可以关联客户类型、资料包、任务模板和推荐标签，方便销售跟进和运营管理。"
          : "销售仅查看启用中的业务线推荐，用于跟进时参考，不提供新增、编辑、暂停或归档入口。"
      }
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {canEdit ? (
          <Card>
            <h2 className="mb-4 text-base font-semibold text-slate-950">新增业务线／产品</h2>
            <BusinessLineForm action={createAction} submitText="新增业务线" materials={materials} taskTemplates={taskTemplates} canArchive={canArchive} />
          </Card>
        ) : null}

        <div className="space-y-4">
          {businessLines.length ? (
            businessLines.map((businessLine) => {
              const updateAction = updateBusinessLine.bind(null, tenant.slug, businessLine.id);

              return canEdit ? (
                <Card key={businessLine.id}>
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-emerald-700">{labelOf(businessLineCategoryOptions, businessLine.category)}</p>
                      <h2 className="text-lg font-semibold text-slate-950">{businessLine.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {labelOf(businessLineStatusOptions, businessLine.status)} ／ 适合客户类型 {parseBusinessLineCustomerTypes(businessLine.targetCustomerTypes).length || 0} 类 ／ 推荐标签 {countBusinessLineTags(businessLine)} 个 ／ 资料包 {countBusinessLineMaterials(businessLine)} 个 ／ 任务模板 {countBusinessLineTaskTemplates(businessLine)} 个
                      </p>
                    </div>
                    <StatusActionButtons tenantSlug={tenant.slug} businessLine={businessLine} canArchive={canArchive} />
                  </div>
                  <BusinessLineForm
                    action={updateAction}
                    submitText="保存业务线"
                    materials={materials}
                    taskTemplates={taskTemplates}
                    businessLine={businessLine}
                    canArchive={canArchive}
                  />
                </Card>
              ) : (
                <BusinessLineReadonlyCard key={businessLine.id} businessLine={businessLine} materialsById={materialsById} taskTemplatesById={taskTemplatesById} />
              );
            })
          ) : (
            <Card>
              <p className="text-sm text-slate-500">{canEdit ? "当前还没有业务线，先新增一条。": "当前没有可查看的启用业务线。"}</p>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
