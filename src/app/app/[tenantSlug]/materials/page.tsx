/*
 * 文件说明：该文件实现企业项目后台的销售资料清单页面。
 * 功能说明：按客户类型展示资料完整度，默认只显示清单状态，管理员和运营按需展开编辑详情。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：资料状态与分组工具
 *   第三部分：资料编辑表单与清单展示
 *   第四部分：销售资料清单页面
 */
import { createMaterial, updateMaterial } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerTypeOptions, formatDate, labelOf, materialTypeOptions } from "@/lib/options";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";
import type { CustomerType, UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const nullableCustomerTypeOptions = [{ value: "", label: "通用资料" }, ...customerTypeOptions];

type MaterialItem = Awaited<ReturnType<typeof prisma.material.findMany>>[number];
type StrategyItem = Awaited<ReturnType<typeof prisma.customerTypeStrategy.findMany>>[number];
type MaterialChecklistRow = {
  title: string;
  material?: MaterialItem;
  complete: boolean;
};
type MaterialChecklistGroup = {
  key: CustomerType | "GENERAL";
  label: string;
  expectedTitles: string[];
  rows: MaterialChecklistRow[];
};

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function isMaterialComplete(material?: MaterialItem) {
  if (!material) return false;
  return Boolean(material.title.trim() && material.url.trim() && material.description?.trim());
}

function buildChecklistGroup(input: {
  key: CustomerType | "GENERAL";
  label: string;
  expectedTitles: string[];
  materials: MaterialItem[];
}): MaterialChecklistGroup {
  const usedMaterialIds = new Set<string>();
  const materialByTitle = new Map(input.materials.map((material) => [normalizeTitle(material.title), material]));
  const rowsFromExpected = input.expectedTitles.map((title) => {
    const material = materialByTitle.get(normalizeTitle(title));
    if (material) usedMaterialIds.add(material.id);
    return {
      title,
      material,
      complete: isMaterialComplete(material)
    };
  });
  const extraRows = input.materials
    .filter((material) => !usedMaterialIds.has(material.id))
    .map((material) => ({
      title: material.title,
      material,
      complete: isMaterialComplete(material)
    }));

  return {
    key: input.key,
    label: input.label,
    expectedTitles: input.expectedTitles,
    rows: [...rowsFromExpected, ...extraRows]
  };
}

function buildMaterialGroups(materials: MaterialItem[], strategies: StrategyItem[]) {
  const strategyByCustomerType = new Map(strategies.map((strategy) => [strategy.customerType, strategy]));
  const materialsByCustomerType = new Map<CustomerType | "GENERAL", MaterialItem[]>();

  for (const material of materials) {
    const key = (material.customerType ?? "GENERAL") as CustomerType | "GENERAL";
    materialsByCustomerType.set(key, [...(materialsByCustomerType.get(key) ?? []), material]);
  }

  const groups = customerTypeOptions
    .filter((option) => strategyByCustomerType.has(option.value as CustomerType) || materialsByCustomerType.has(option.value as CustomerType))
    .map((option) => {
      const customerType = option.value as CustomerType;
      return buildChecklistGroup({
        key: customerType,
        label: `${option.label}资料包`,
        expectedTitles: strategyByCustomerType.get(customerType)?.firstMaterials ?? [],
        materials: materialsByCustomerType.get(customerType) ?? []
      });
    });

  const generalMaterials = materialsByCustomerType.get("GENERAL") ?? [];
  if (generalMaterials.length) {
    groups.unshift(
      buildChecklistGroup({
        key: "GENERAL",
        label: "通用资料包",
        expectedTitles: [],
        materials: generalMaterials
      })
    );
  }

  return groups;
}

function completenessText(group: MaterialChecklistGroup) {
  const completeCount = group.rows.filter((row) => row.complete).length;
  if (group.expectedTitles.length) {
    return `${completeCount}/${group.rows.length}`;
  }
  return group.rows.length ? `已配置 ${group.rows.length} 项` : "暂无资料";
}

function StatusBadge({ complete, missing }: { complete: boolean; missing?: boolean }) {
  if (missing) {
    return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">暂无资料</span>;
  }
  return complete ? (
    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">已完善</span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">待补充</span>
  );
}

function MaterialEditForm({ tenantSlug, material }: { tenantSlug: string; material: MaterialItem }) {
  const action = updateMaterial.bind(null, tenantSlug, material.id);

  return (
    <form action={action} className="rounded-md border border-slate-200 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="标题" name="title" defaultValue={material.title} required />
        <Select label="类型" name="type" options={materialTypeOptions} defaultValue={material.type} />
        <Input label="链接" name="url" defaultValue={material.url} required />
        <Select label="绑定客户类型" name="customerType" options={nullableCustomerTypeOptions} defaultValue={material.customerType ?? ""} />
      </div>
      <div className="mt-4">
        <Textarea label="描述" name="description" defaultValue={material.description ?? ""} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">创建时间：{formatDate(material.createdAt)}</span>
        <SubmitButton>保存资料包</SubmitButton>
      </div>
    </form>
  );
}

function MaterialRow({
  tenantSlug,
  row,
  canManage
}: {
  tenantSlug: string;
  row: MaterialChecklistRow;
  canManage: boolean;
}) {
  const material = row.material;

  return (
    <details className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-950">{row.title}</p>
            <p className="mt-1 text-xs text-slate-500">{material ? labelOf(materialTypeOptions, material.type) : "待补充资料"}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge complete={row.complete} missing={!material} />
            <span className="text-xs font-medium text-emerald-700">{canManage ? "展开 / 编辑" : "展开详情"}</span>
          </div>
        </div>
      </summary>
      <div className="mt-3 border-t border-slate-100 pt-3">
        {material ? (
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              链接：
              <a className="text-emerald-700 hover:underline" href={material.url} target="_blank">
                {material.url}
              </a>
            </p>
            <p>描述：{material.description?.trim() || "待补充描述"}</p>
            <p className="text-xs text-slate-500">创建时间：{formatDate(material.createdAt)}</p>
            {canManage ? <MaterialEditForm tenantSlug={tenantSlug} material={material} /> : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">当前资料项还没有创建，运营或管理员可在左侧新增资料后绑定到该客户类型。</p>
        )}
      </div>
    </details>
  );
}

function MaterialGroupCard({ tenantSlug, group, canManage }: { tenantSlug: string; group: MaterialChecklistGroup; canManage: boolean }) {
  const hasRows = group.rows.length > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {group.label}（{completenessText(group)}）
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {group.expectedTitles.length ? "按策略库预期资料项核对完整度。" : "当前没有预期模板，按已配置资料统计。"}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {hasRows ? (
          group.rows.map((row) => <MaterialRow key={`${group.key}-${row.title}-${row.material?.id ?? "missing"}`} tenantSlug={tenantSlug} row={row} canManage={canManage} />)
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
            <StatusBadge complete={false} missing />
            <p className="mt-2">暂无资料。</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default async function MaterialsPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const canManage = (["TENANT_ADMIN", "OPERATOR"] as UserRole[]).includes(user.role);
  const [materials, strategies] = await Promise.all([
    prisma.material.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ customerType: "asc" }, { createdAt: "desc" }]
    }),
    prisma.customerTypeStrategy.findMany({
      where: { tenantId: tenant.id },
      orderBy: { customerType: "asc" }
    })
  ]);
  const groups = buildMaterialGroups(materials, strategies);
  const action = createMaterial.bind(null, tenant.slug);

  return (
    <PageShell tenant={tenant} title="销售资料清单" description="按客户类型整理资料完整度，销售需要时再展开查看。">
      <div className={canManage ? "grid gap-6 lg:grid-cols-[340px_1fr]" : "space-y-6"}>
        {canManage ? (
          <Card>
            <h2 className="mb-4 text-base font-semibold">新增资料</h2>
            <form action={action} className="space-y-4">
              <Input label="标题" name="title" required />
              <Textarea label="描述" name="description" />
              <Select label="类型" name="type" options={materialTypeOptions} />
              <Input label="链接" name="url" required />
              <Select label="绑定客户类型" name="customerType" options={nullableCustomerTypeOptions} />
              <SubmitButton>新增资料</SubmitButton>
            </form>
          </Card>
        ) : null}
        <div className="space-y-4">
          {groups.length ? (
            groups.map((group) => <MaterialGroupCard key={group.key} tenantSlug={tenant.slug} group={group} canManage={canManage} />)
          ) : (
            <Card>
              <h2 className="text-base font-semibold text-slate-950">资料清单</h2>
              <p className="mt-2 text-sm text-slate-500">暂无资料。</p>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
