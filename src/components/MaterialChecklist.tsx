import type { CustomerType } from "@prisma/client";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";
import { customerTypeOptions, formatDate, labelOf, materialTypeOptions } from "@/lib/options";

export type MaterialChecklistRecord = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  url: string;
  customerType: CustomerType | null;
  createdAt: Date;
};

export const materialTypeChoices = materialTypeOptions;

function materialTypeLabel(value?: string | null) {
  if (!value) return "链接";
  return labelOf(materialTypeOptions, value);
}

export function materialStatusLabel(material: Pick<MaterialChecklistRecord, "title" | "url">) {
  return material.title.trim() && material.url.trim() ? "已完善" : "待补充";
}

function StatusBadge({ label }: { label: "已完善" | "待补充" }) {
  return label === "已完善" ? (
    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">已完善</span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">待补充</span>
  );
}

export function MaterialCreatePanel({
  action,
  customerTypeDefault = ""
}: {
  action: ComponentPropsWithoutRef<"form">["action"];
  customerTypeDefault?: string;
}) {
  return (
    <Card>
      <details>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">新增资料链接</h2>
              <p className="mt-1 text-sm text-slate-500">建议直接保存腾讯文档、飞书文档、PDF 或视频链接，先把销售能发的资料清单整理出来。</p>
            </div>
            <span className="text-sm font-medium text-emerald-700">展开 / 编辑</span>
          </div>
        </summary>
        <form action={action} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="标题" name="title" required />
            <Select label="类型" name="type" options={materialTypeChoices} defaultValue="link" />
            <Select label="客户类型" name="customerType" options={[{ value: "", label: "通用资料" }, ...customerTypeOptions]} defaultValue={customerTypeDefault} />
            <Input label="链接" name="url" required />
          </div>
          <Textarea label="描述" name="description" />
          <div className="flex justify-end">
            <SubmitButton>保存资料链接</SubmitButton>
          </div>
        </form>
      </details>
    </Card>
  );
}

export function MaterialChecklistGroup({
  title,
  description,
  materials,
  children
}: {
  title: string;
  description: string;
  materials: MaterialChecklistRecord[];
  children: ReactNode;
}) {
  const completeCount = materials.filter((material) => materialStatusLabel(material) === "已完善").length;
  const pendingCount = materials.length - completeCount;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {title}
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({completeCount} 已完善，{pendingCount} 待补充)
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <StatusBadge label={pendingCount === 0 ? "已完善" : "待补充"} />
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </Card>
  );
}

export function MaterialChecklistItem({
  material,
  canManage,
  editAction
}: {
  material: MaterialChecklistRecord;
  canManage: boolean;
  editAction?: ComponentPropsWithoutRef<"form">["action"];
}) {
  const status = materialStatusLabel(material);
  const customerTypeLabel = material.customerType ? labelOf(customerTypeOptions, material.customerType) : "通用资料";

  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-950">{material.title}</p>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{materialTypeLabel(material.type)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">客户类型：{customerTypeLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge label={status} />
            <span className="text-xs font-medium text-emerald-700">{canManage ? "展开 / 编辑" : "展开详情"}</span>
          </div>
        </div>
      </summary>
      <div className="border-t border-slate-100 px-4 py-4">
        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="md:col-span-2">
            <span className="font-medium text-slate-900">链接：</span>
            <a className="text-emerald-700 hover:underline" href={material.url} target="_blank" rel="noreferrer">
              {material.url}
            </a>
          </div>
          <div>
            <span className="font-medium text-slate-900">描述：</span>
            {material.description?.trim() || "待补充描述"}
          </div>
          <div>
            <span className="font-medium text-slate-900">创建时间：</span>
            {formatDate(material.createdAt)}
          </div>
        </div>
        {canManage && editAction ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-medium text-slate-900">编辑资料链接</p>
            <form action={editAction} className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="标题" name="title" defaultValue={material.title} required />
                <Select label="类型" name="type" options={materialTypeChoices} defaultValue={material.type === "image" ? "document" : material.type} />
                <Select
                  label="客户类型"
                  name="customerType"
                  options={[{ value: "", label: "通用资料" }, ...customerTypeOptions]}
                  defaultValue={material.customerType ?? ""}
                />
                <Input label="链接" name="url" defaultValue={material.url} required />
              </div>
              <Textarea label="描述" name="description" defaultValue={material.description ?? ""} />
              <div className="flex justify-end">
                <SubmitButton>保存资料链接</SubmitButton>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </details>
  );
}
