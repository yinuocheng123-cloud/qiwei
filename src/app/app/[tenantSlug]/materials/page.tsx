/*
 * 文件说明：该文件实现企业项目后台的资料包管理页面。
 * 功能说明：运营与企业管理员可以新增、编辑资料包，并按客户类型绑定到客户详情推荐。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：资料包编辑表单
 *   第三部分：资料包管理页面
 */
import { createMaterial, updateMaterial } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerTypeOptions, formatDate, labelOf, materialTypeOptions } from "@/lib/options";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

const nullableCustomerTypeOptions = [{ value: "", label: "通用资料" }, ...customerTypeOptions];

type MaterialItem = Awaited<ReturnType<typeof prisma.material.findMany>>[number];

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

export default async function MaterialsPage({ params }: { params: { tenantSlug: string } }) {
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const materials = await prisma.material.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" }
  });
  const action = createMaterial.bind(null, tenant.slug);

  return (
    <PageShell tenant={tenant} title="资料包管理" description="资料包可绑定客户类型，并在客户详情页自动推荐给销售查看。">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-base font-semibold">新增资料包</h2>
          <form action={action} className="space-y-4">
            <Input label="标题" name="title" required />
            <Textarea label="描述" name="description" />
            <Select label="类型" name="type" options={materialTypeOptions} />
            <Input label="链接" name="url" required />
            <Select label="绑定客户类型" name="customerType" options={nullableCustomerTypeOptions} />
            <SubmitButton>新增资料</SubmitButton>
          </form>
        </Card>
        <Card>
          <h2 className="mb-4 text-base font-semibold">资料列表</h2>
          <div className="space-y-4">
            {materials.length ? (
              materials.map((material) => (
                <div key={material.id} className="space-y-3">
                  <div className="rounded-md bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <a className="font-medium text-emerald-700" href={material.url} target="_blank">
                        {material.title}
                      </a>
                      <span className="text-slate-500">
                        {labelOf(materialTypeOptions, material.type)} / {labelOf(nullableCustomerTypeOptions, material.customerType ?? "")}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">{material.description ?? "-"}</p>
                  </div>
                  <MaterialEditForm tenantSlug={tenant.slug} material={material} />
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">暂无资料包。</p>
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
