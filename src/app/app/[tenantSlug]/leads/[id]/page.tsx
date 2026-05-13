/*
 * 文件说明：该文件实现客户详情页。
 * 功能说明：展示客户信息、负责人分配、策略推荐、资料包推荐、跟进记录和 V1.3.1 手动任务创建。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：详情页查询
 *   第三部分：客户信息、策略、资料、跟进和任务表单
 */
import { notFound } from "next/navigation";
import { addFollowUp, assignLeadOwner, createManualTask } from "@/lib/actions";
import { requireLeadAccess } from "@/lib/auth";
import {
  customerTypeOptions,
  formatDate,
  intentionOptions,
  labelOf,
  needTypeOptions,
  sourceOptions,
  stageOptions,
  taskPriorityOptions,
  taskStatusOptions,
  taskTypeOptions
} from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { tenantSlug: string; id: string } }) {
  const { user, tenant } = await requireLeadAccess(params.tenantSlug, params.id);
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, tenantId: tenant.id },
    include: {
      owner: true,
      tags: true,
      followUps: { include: { user: true }, orderBy: { createdAt: "desc" } }
    }
  });

  if (!lead) notFound();

  const [strategy, materials, owners, taskTemplates, currentTasks] = await Promise.all([
    prisma.customerTypeStrategy.findUnique({
      where: { tenantId_customerType: { tenantId: tenant.id, customerType: lead.customerType } }
    }),
    prisma.material.findMany({
      where: { tenantId: tenant.id, OR: [{ customerType: lead.customerType }, { customerType: null }] },
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
    prisma.taskTemplate.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        AND: [
          { OR: [{ customerType: lead.customerType }, { customerType: null }] },
          { OR: [{ stage: lead.stage }, { stage: null }] }
        ]
      },
      orderBy: [{ customerType: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.followTask.findMany({
      where: {
        tenantId: tenant.id,
        leadId: lead.id,
        status: { in: ["PENDING", "DELAYED", "DONE"] }
      },
      include: { owner: true },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 6
    })
  ]);

  const followAction = addFollowUp.bind(null, tenant.slug, lead.id);
  const assignAction = assignLeadOwner.bind(null, tenant.slug, lead.id);
  const manualTaskAction = createManualTask.bind(null, tenant.slug, lead.id);
  const canAssign = user.role === "TENANT_ADMIN" || user.role === "OPERATOR";
  const ownerOptions = [{ value: "", label: "未分配" }, ...owners.map((owner) => ({ value: owner.id, label: `${owner.name}（${owner.role}）` }))];
  const taskOwnerOptions = owners.map((owner) => ({ value: owner.id, label: `${owner.name}（${owner.role}）` }));
  const taskTemplateOptions = [{ value: "", label: "不使用模板" }, ...taskTemplates.map((template) => ({ value: template.id, label: template.name }))];
  const manualTaskTypeOptions = [{ value: "", label: "沿用模板默认类型" }, ...taskTypeOptions];
  const manualTaskPriorityOptions = [{ value: "", label: "沿用模板默认优先级" }, ...taskPriorityOptions];

  return (
    <PageShell tenant={tenant} title={`客户详情：${lead.name}`} description="客户详情继续基于客户类型策略库驱动资料、话术、下一步动作和销售任务。">
      <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-base font-semibold">客户基础信息</h2>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <Info label="电话" value={lead.phone} />
              <Info label="微信" value={lead.wechat} />
              <Info label="公司" value={lead.company} />
              <Info label="城市" value={lead.city} />
              <Info label="来源渠道" value={labelOf(sourceOptions, lead.source)} />
              <Info label="当前客户类型" value={labelOf(customerTypeOptions, lead.customerType)} />
              <Info label="需求类型" value={labelOf(needTypeOptions, lead.needType)} />
              <Info label="意向等级" value={labelOf(intentionOptions, lead.intentionLevel)} />
              <Info label="当前阶段" value={labelOf(stageOptions, lead.stage)} />
              <Info label="负责人" value={lead.owner?.name ?? "未分配"} />
              <Info label="下次跟进" value={formatDate(lead.nextFollowAt)} />
              <Info label="最后跟进" value={formatDate(lead.lastFollowAt)} />
            </div>
            {lead.message ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{lead.message}</p> : null}
          </Card>

          {canAssign ? (
            <Card>
              <h2 className="mb-4 text-base font-semibold">客户分配</h2>
              <form action={assignAction} className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Select label="负责人" name="ownerId" options={ownerOptions} defaultValue={lead.ownerId ?? ""} />
                <div className="pt-6">
                  <SubmitButton>保存分配</SubmitButton>
                </div>
              </form>
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-4 text-base font-semibold">标签</h2>
            <div className="flex flex-wrap gap-2">
              {lead.tags.length ? (
                lead.tags.map((tag) => (
                  <span key={tag.id} className="rounded-md bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                    {tag.tagName}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">暂无标签</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold">销售跟进记录</h2>
            <div className="space-y-3">
              {lead.followUps.length ? (
                lead.followUps.map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2 text-slate-500">
                      <span>{item.user.name}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-slate-800">{item.content}</p>
                    <p className="mt-2 text-slate-500">下一步：{item.nextAction ?? "-"}</p>
                    <p className="text-slate-500">
                      阶段：{labelOf(stageOptions, item.stageBefore)} 到 {labelOf(stageOptions, item.stageAfter)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">暂无跟进记录</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold">当前任务</h2>
            <div className="space-y-3">
              {currentTasks.length ? (
                currentTasks.map((task) => (
                  <div key={task.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-emerald-700">{task.title}</span>
                      <span className="text-slate-500">{formatDate(task.dueAt)}</span>
                    </div>
                    <p className="mt-1 text-slate-600">
                      {labelOf(taskTypeOptions, task.type)} / {labelOf(taskPriorityOptions, task.priority)} / {labelOf(taskStatusOptions, task.status)}
                    </p>
                    <p className="mt-1 text-slate-500">负责人：{task.owner?.name ?? "未分配"}</p>
                    {task.description ? <p className="mt-1 text-slate-500">{task.description}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">当前客户暂无任务</p>
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-4 text-base font-semibold">推荐转化策略</h2>
            {strategy ? (
              <div className="space-y-4 text-sm">
                <StrategyBlock title="客户关心点" value={strategy.painPoints.join("、")} />
                <StrategyBlock title="推荐首发资料" value={strategy.firstMaterials.join("、")} />
                <ScriptBlock title="推荐欢迎语" value={strategy.welcomeScript} />
                <ScriptBlock title="3 天跟进话术" value={strategy.day3Script} />
                <ScriptBlock title="7 天跟进话术" value={strategy.day7Script} />
                <ScriptBlock title="15 天激活话术" value={strategy.day15Script} />
                <StrategyBlock title="人工介入条件" value={strategy.manualTriggerRules.join("、")} />
                <StrategyBlock title="推荐下一步动作" value={strategy.recommendedNextAction} />
                <StrategyBlock title="推荐私域内容" value={strategy.recommendedPrivateContent} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">当前客户类型暂未配置策略。</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold">绑定资料包</h2>
            <div className="space-y-2 text-sm">
              {materials.length ? (
                materials.map((material) => (
                  <a key={material.id} className="block rounded-md border border-slate-200 px-3 py-2 text-emerald-700" href={material.url} target="_blank">
                    <span className="font-medium">{material.title}</span>
                    <span className="ml-2 text-slate-500">{material.description ?? ""}</span>
                  </a>
                ))
              ) : (
                <p className="text-slate-500">暂无匹配资料。</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold">创建任务</h2>
            <form action={manualTaskAction} className="space-y-4">
              <Select label="任务模板" name="templateId" options={taskTemplateOptions} defaultValue="" />
              <p className="text-xs text-slate-500">选择模板后，空白字段会自动使用模板内容和默认到期时间。</p>
              <Input label="任务标题" name="title" />
              <Textarea label="任务说明" name="description" rows={3} />
              <Select label="任务类型" name="type" options={manualTaskTypeOptions} defaultValue="" />
              <Select label="优先级" name="priority" options={manualTaskPriorityOptions} defaultValue="" />
              {canAssign ? <Select label="负责人" name="ownerId" options={taskOwnerOptions} defaultValue={lead.ownerId ?? taskOwnerOptions[0]?.value} /> : <input type="hidden" name="ownerId" value={user.id} />}
              <Input label="截止时间" name="dueAt" type="datetime-local" />
              <SubmitButton>创建任务</SubmitButton>
            </form>
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold">新增跟进</h2>
            <form action={followAction} className="space-y-4">
              <Textarea label="跟进内容" name="content" rows={4} />
              <Input label="下一步动作" name="nextAction" defaultValue={strategy?.recommendedNextAction ?? ""} />
              {strategy?.recommendedNextAction ? <p className="text-xs text-slate-500">已默认填入推荐下一步动作，可按实际沟通修改。</p> : null}
              <Select label="更新阶段" name="stageAfter" options={stageOptions} defaultValue={lead.stage} />
              <Input label="下次跟进时间" name="nextFollowAt" type="datetime-local" />
              <SubmitButton>保存跟进</SubmitButton>
            </form>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value ?? "-"}</p>
    </div>
  );
}

function StrategyBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-slate-950">{title}</p>
      <p className="mt-1 leading-6 text-slate-700">{value || "-"}</p>
    </div>
  );
}

function ScriptBlock({ title, value }: { title: string; value: string }) {
  return (
    <label className="block">
      <span className="font-medium text-slate-950">{title}</span>
      <textarea className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700" rows={3} readOnly value={value || "-"} />
    </label>
  );
}
