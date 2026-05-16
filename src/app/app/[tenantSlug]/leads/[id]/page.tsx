/*
 * 文件说明：该文件实现客户详情页。
 * 功能说明：展示客户基础信息、策略推荐、资料包、跟进记录、任务，以及 V1.5 智能跟进助手。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：详情页查询与表单动作绑定
 *   第三部分：主界面渲染
 *   第四部分：辅助展示组件
 */
import { notFound } from "next/navigation";
import { LeadReplyAssistant } from "@/components/LeadReplyAssistant";
import { MarketClawAssistant } from "@/components/MarketClawAssistant";
import { PageShell } from "@/components/Shell";
import { Callout, Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";
import { addFollowUp, assignLeadOwner, createManualTask } from "@/lib/actions";
import { requireLeadAccess } from "@/lib/auth";
import { readCnasExtraData } from "@/lib/cnas";
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
import { getLatestReplySuggestionBatch } from "@/lib/reply-suggestions";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { tenantSlug: string; id: string } }) {
  const { user, tenant } = await requireLeadAccess(params.tenantSlug, params.id);
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, tenantId: tenant.id },
    include: {
      owner: true,
      sourceAttribution: true,
      tags: true,
      followUps: { include: { user: true }, orderBy: { createdAt: "desc" } }
    }
  });

  if (!lead) notFound();
  const cnasData = readCnasExtraData(lead.extraData);

  const [strategy, materials, assistantMaterials, owners, taskTemplates, currentTasks, replySuggestions, marketClawDrafts, marketClawKnowledgeItems, activeBusinessLines] = await Promise.all([
    prisma.customerTypeStrategy.findUnique({
      where: { tenantId_customerType: { tenantId: tenant.id, customerType: lead.customerType } }
    }),
    prisma.material.findMany({
      where: { tenantId: tenant.id, OR: [{ customerType: lead.customerType }, { customerType: null }] },
      orderBy: { createdAt: "desc" }
    }),
    prisma.material.findMany({
      where: { tenantId: tenant.id },
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
        AND: [{ OR: [{ customerType: lead.customerType }, { customerType: null }] }, { OR: [{ stage: lead.stage }, { stage: null }] }]
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
    }),
    getLatestReplySuggestionBatch(tenant.id, lead.id, user.id),
    prisma.marketClawReplyDraft.findMany({
      where: {
        tenantId: tenant.id,
        leadId: lead.id,
        createdById: user.id
      },
      orderBy: { createdAt: "desc" },
      take: 3
    }),
    prisma.marketClawKnowledgeItem.findMany({
      where: {
        tenantId: tenant.id,
        status: "ACTIVE"
      },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.businessLine.findMany({
      where: {
        tenantId: tenant.id,
        status: "ACTIVE"
      },
      select: { id: true, name: true },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
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
    <PageShell
      tenant={tenant}
      title={`客户详情：${lead.name}`}
      breadcrumbs={[
        { label: "客户管理", href: `/app/${tenant.slug}/leads` },
        { label: "客户详情", href: `/app/${tenant.slug}/leads/${lead.id}` },
        { label: lead.name }
      ]}
      description="客户详情页基于客户类型策略库驱动资料、话术、下一步动作、任务和智能跟进助手。"
    >
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

          {lead.sourceAttribution ? (
            <Card>
              <h2 className="mb-2 text-base font-semibold">来源归因</h2>
              <p className="mb-4 text-sm leading-6 text-slate-600">
                来源归因用于判断客户到底从哪个入口进入系统，帮助后续复盘哪个活动、哪个页面、哪个二维码、哪个业务员带来的线索质量更高。
              </p>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <Info label="来源渠道" value={lead.sourceAttribution.sourceChannel ?? labelOf(sourceOptions, lead.source)} />
                <Info label="来源项目" value={lead.sourceAttribution.sourceProject} />
                <Info label="来源活动" value={lead.sourceAttribution.sourceCampaign} />
                <Info label="来源场景" value={lead.sourceAttribution.sourceScene} />
                <Info label="来源触点" value={lead.sourceAttribution.sourceTouchpoint} />
                <Info label="来源二维码" value={lead.sourceAttribution.sourceQrCode} />
                <Info label="来源人员" value={lead.sourceAttribution.sourceStaffName} />
                <Info label="来源页面" value={lead.sourceAttribution.sourcePage} />
                <Info label="来源内容" value={lead.sourceAttribution.sourceContent} />
                <Info label="UTM Source" value={lead.sourceAttribution.utmSource} />
                <Info label="UTM Medium" value={lead.sourceAttribution.utmMedium} />
                <Info label="UTM Campaign" value={lead.sourceAttribution.utmCampaign} />
                <Info label="UTM Content" value={lead.sourceAttribution.utmContent} />
                <Info label="UTM Term" value={lead.sourceAttribution.utmTerm} />
                <Info label="首次来源时间" value={formatDate(lead.sourceAttribution.firstSeenAt)} />
                <Info label="提交时间" value={formatDate(lead.sourceAttribution.submittedAt)} />
              </div>
            </Card>
          ) : null}

          {cnasData ? (
            <Card>
              <h2 className="mb-4 text-base font-semibold">CNAS 初步判断</h2>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <Info label="判断类型" value={`${cnasData.diagnosisType} 类`} />
                <Info label="建议下一步" value={cnasData.nextAction} />
                <Info label="实验室类型" value={cnasData.questionnaire.labType} />
                <Info label="当前阶段" value={cnasData.questionnaire.currentStage} />
                <Info label="认可范围" value={cnasData.questionnaire.scopeClarity} />
                <Info label="人员设备" value={cnasData.questionnaire.readiness} />
                <Info label="主要担心问题" value={cnasData.questionnaire.primaryConcern} />
                <Info label="启动计划" value={cnasData.questionnaire.startPlan} />
                <Info label="来源页面" value={cnasData.sourcePage} />
                <Info label="UTM Source" value={cnasData.utm.utm_source} />
                <Info label="UTM Medium" value={cnasData.utm.utm_medium} />
                <Info label="UTM Campaign" value={cnasData.utm.utm_campaign} />
              </div>
              <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{cnasData.diagnosisSummary}</p>
            </Card>
          ) : null}

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
          <Callout title={user.role === "SALES" ? "销售使用路径" : "当前页面路径"} tone={user.role === "SALES" ? "emerald" : "slate"}>
            {user.role === "SALES"
              ? "先看客户当前阶段和任务，再在这里使用 Market Claw 生成回复，回复后补一条跟进记录并确认下一步动作。"
              : "这里是客户管理和 Market Claw 的交汇点，既能看客户状态，也能直接验证回复、资料和跟进建议是否匹配。"}
          </Callout>

          <MarketClawAssistant
            tenantSlug={tenant.slug}
            leadId={lead.id}
            businessLines={activeBusinessLines}
            drafts={marketClawDrafts}
            materials={assistantMaterials.map((material) => ({ id: material.id, title: material.title }))}
            knowledgeItems={marketClawKnowledgeItems}
            existingTags={lead.tags.map((tag) => ({ id: tag.id, tagName: tag.tagName, tagGroup: tag.tagGroup }))}
          />

          <LeadReplyAssistant
            tenantSlug={tenant.slug}
            leadId={lead.id}
            leadName={lead.name}
            customerType={lead.customerType}
            stage={lead.stage}
            suggestions={replySuggestions}
            materials={assistantMaterials.map((material) => ({ id: material.id, title: material.title }))}
            existingTags={lead.tags.map((tag) => ({ id: tag.id, tagName: tag.tagName }))}
          />

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
              <p className="text-xs text-slate-500">选择模板后，空白字段会自动沿用模板内容和默认到期时间。</p>
              <Input label="任务标题" name="title" />
              <Textarea label="任务说明" name="description" rows={3} />
              <Select label="任务类型" name="type" options={manualTaskTypeOptions} defaultValue="" />
              <Select label="优先级" name="priority" options={manualTaskPriorityOptions} defaultValue="" />
              {canAssign ? (
                <Select label="负责人" name="ownerId" options={taskOwnerOptions} defaultValue={lead.ownerId ?? taskOwnerOptions[0]?.value} />
              ) : (
                <input type="hidden" name="ownerId" value={user.id} />
              )}
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
