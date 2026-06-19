/*
 * 文件说明：该页面实现 V1.3.1 任务模板管理。
 * 功能说明：企业管理员和运营可以新增、编辑、停用任务模板，销售角色不可访问。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：页面数据查询与新增表单
 *   第三部分：模板编辑卡片
 */
import { createTaskTemplate, deactivateTaskTemplate, updateTaskTemplate } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import { getCustomerTypeOptionsForBusinessLine } from "@/lib/marketclaw-context";
import { labelOf, stageOptions, taskPriorityOptions, taskTypeOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { resolveBusinessLineScope } from "@/lib/scope";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

const anyStageOptions = [{ value: "", label: "不限客户阶段" }, ...stageOptions];

export default async function TaskTemplatesPage({
  params,
  searchParams
}: {
  params: { tenantSlug: string };
  searchParams?: Record<string, string | undefined>;
}) {
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const scope = await resolveBusinessLineScope(tenant.id, searchParams);
  const scopedCustomerTypeOptions = getCustomerTypeOptionsForBusinessLine(scope.enterpriseKey, scope.businessLineKey);
  const anyCustomerTypeOptions = [{ value: "", label: "不限客户类型" }, ...scopedCustomerTypeOptions];
  const templates = await prisma.taskTemplate.findMany({
    where: { tenantId: tenant.id, ...(scope.businessLineId ? { businessLineId: scope.businessLineId } : {}) },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }]
  });
  const createAction = createTaskTemplate.bind(null, tenant.slug);

  return (
    <PageShell
      tenant={tenant}
      title={`任务模板 · ${scope.businessLineDefinition.name}`}
      description={`模板用于快速创建 ${scope.businessLineDefinition.name} 的销售跟进任务，后续可作为自动化提醒规则的配置基础。`}
      enterpriseKey={scope.enterpriseKey}
      businessLineKey={scope.businessLineKey}
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <h2 className="mb-4 text-base font-semibold">新增模板</h2>
          <form action={createAction} className="space-y-4">
            <Input label="模板名称" name="name" required />
            <Input label="任务标题" name="title" required />
            <Textarea label="任务说明" name="description" rows={4} />
            <Select label="任务类型" name="type" options={taskTypeOptions} defaultValue="CUSTOM" />
            <Select label="优先级" name="priority" options={taskPriorityOptions} defaultValue="NORMAL" />
            <Input label="默认几天后到期" name="defaultDueDays" type="number" defaultValue="1" />
            <Select label="绑定客户类型" name="customerType" options={anyCustomerTypeOptions} defaultValue="" />
            <Select label="绑定客户阶段" name="stage" options={anyStageOptions} defaultValue="" />
            <SubmitButton>创建模板</SubmitButton>
          </form>
        </Card>

        <div className="space-y-4">
          {templates.length ? (
            templates.map((template) => (
              <Card key={template.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{template.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {labelOf(taskTypeOptions, template.type)} / {labelOf(taskPriorityOptions, template.priority)} / {template.isActive ? "启用中" : "已停用"}
                    </p>
                  </div>
                  {template.isActive ? (
                    <form action={deactivateTaskTemplate.bind(null, tenant.slug, template.id)}>
                      <button className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700">停用</button>
                    </form>
                  ) : null}
                </div>
                <form action={updateTaskTemplate.bind(null, tenant.slug, template.id)} className="grid gap-4 md:grid-cols-2">
                  <Input label="模板名称" name="name" defaultValue={template.name} required />
                  <Input label="任务标题" name="title" defaultValue={template.title} required />
                  <Textarea label="任务说明" name="description" defaultValue={template.description ?? ""} rows={3} />
                  <div className="space-y-4">
                    <Select label="任务类型" name="type" options={taskTypeOptions} defaultValue={template.type} />
                    <Select label="优先级" name="priority" options={taskPriorityOptions} defaultValue={template.priority} />
                    <Input label="默认几天后到期" name="defaultDueDays" type="number" defaultValue={String(template.defaultDueDays)} />
                    <Select label="绑定客户类型" name="customerType" options={anyCustomerTypeOptions} defaultValue={template.customerType ?? ""} />
                    <Select label="绑定客户阶段" name="stage" options={anyStageOptions} defaultValue={template.stage ?? ""} />
                    <SubmitButton>保存模板</SubmitButton>
                  </div>
                </form>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm text-slate-500">暂无任务模板。</p>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
