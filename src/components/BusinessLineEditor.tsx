/*
 * 文件说明：该文件提供业务配置中的产品表单与状态操作组件。
 * 功能说明：复用产品新增、编辑、状态切换表单，避免产品总览页和详情页重复维护同一套字段。
 *
 * 结构概览：
 *   第一部分：导入依赖与类型
 *   第二部分：表单辅助组件
 *   第三部分：产品表单与状态按钮
 */
import type { BusinessLine, Material, TaskTemplate } from "@prisma/client";
import {
  parseBusinessLineCustomerTypes,
  parseBusinessLineIdList,
  parseBusinessLineRecommendedTags,
  stringifyBusinessLineRecommendedTags
} from "@/lib/business-lines";
import { businessLineCategoryOptions, businessLineStatusOptions, customerTypeOptions, labelOf } from "@/lib/options";
import { Input, Select, SubmitButton, Textarea } from "@/components/Ui";

type BusinessLineItem = Pick<
  BusinessLine,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "status"
  | "category"
  | "priority"
  | "targetCustomerTypes"
  | "recommendedTagNames"
  | "recommendedMaterialIds"
  | "recommendedTaskTemplateIds"
  | "defaultNextAction"
  | "notes"
>;

type MaterialItem = Pick<Material, "id" | "title" | "customerType">;
type TaskTemplateItem = Pick<TaskTemplate, "id" | "name" | "title">;

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

export function BusinessLineForm({
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

      <Textarea label="产品说明" name="description" defaultValue={businessLine?.description ?? ""} rows={3} />

      <CheckboxGroup title="适合客户类型" name="targetCustomerTypes" options={customerTypeOptions} selectedValues={selectedCustomerTypes} />

      <Textarea label="推荐标签" name="recommendedTags" defaultValue={recommendedTagText} rows={4} />
      <p className="text-xs text-slate-500">每行使用“标签名称|标签分组”格式，例如：GEO意向|业务标签。</p>

      <RelatedRecordCheckboxes
        title="关联资料"
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

export function StatusActionButtons({
  tenantSlug,
  businessLine,
  canArchive,
  action
}: {
  tenantSlug: string;
  businessLine: Pick<BusinessLine, "id" | "status">;
  canArchive: boolean;
  action: (tenantSlug: string, businessLineId: string, status: BusinessLine["status"]) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {businessLine.status !== "ACTIVE" ? (
        <form action={action.bind(null, tenantSlug, businessLine.id, "ACTIVE")}>
          <button className="rounded-md border border-emerald-200 px-3 py-2 text-sm text-emerald-700">启用</button>
        </form>
      ) : null}
      {businessLine.status !== "PAUSED" ? (
        <form action={action.bind(null, tenantSlug, businessLine.id, "PAUSED")}>
          <button className="rounded-md border border-amber-200 px-3 py-2 text-sm text-amber-700">暂停</button>
        </form>
      ) : null}
      {canArchive && businessLine.status !== "ARCHIVED" ? (
        <form action={action.bind(null, tenantSlug, businessLine.id, "ARCHIVED")}>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">归档</button>
        </form>
      ) : null}
    </div>
  );
}
