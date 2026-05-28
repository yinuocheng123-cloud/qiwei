/*
 * 文件说明：该页面实现 V2.6 企业微信轻承接测试台。
 * 功能说明：展示承接配置、成员绑定状态、手工/模拟企微客户导入表单和最近承接记录。
 *
 * 结构概览：
 *   第一部分：导入依赖与展示工具
 *   第二部分：测试表单与承接记录组件
 *   第三部分：页面数据读取与渲染
 */
import Link from "next/link";
import { CustomerType, IntentionLevel, NeedType } from "@prisma/client";
import { PageShell } from "@/components/Shell";
import { Callout, Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";
import { requireTenantAccess } from "@/lib/auth";
import {
  cnasCurrentStageOptions,
  cnasLabTypeOptions,
  cnasPrimaryConcernOptions,
  cnasReadinessOptions,
  cnasScopeClarityOptions,
  cnasStartPlanOptions
} from "@/lib/cnas";
import { customerTypeOptions, formatDate, intentionOptions, needTypeOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { simulateWecomCustomerImport } from "@/lib/wecom-light-intake";

export const dynamic = "force-dynamic";

function statusText(value?: string | null) {
  if (!value) return "未配置";
  return value;
}

function BoundaryList() {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li>只做客户承接、成员绑定、来源归因和跟进任务。</li>
      <li>不做聊天同步、不做自动回复、不做会话存档。</li>
      <li>不接深度企业微信 API，不新增 AI Agent。</li>
      <li>CNAS 模板客户进入后，只自动进入 MarketClaw 跟进流程。</li>
    </ul>
  );
}

export default async function WecomLightIntakePage({ params }: { params: { tenantSlug: string } }) {
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const isCnasTemplate = tenant.templateKey === "cnas-pilot";
  const action = simulateWecomCustomerImport.bind(null, tenant.slug);
  const [config, users, recentLeads] = await Promise.all([
    prisma.weComConfig.findUnique({ where: { tenantId: tenant.id } }),
    prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        status: "active",
        role: { in: ["TENANT_ADMIN", "OPERATOR", "SALES"] }
      },
      include: { wecomBinding: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    }),
    prisma.lead.findMany({
      where: {
        tenantId: tenant.id,
        sourceAttribution: {
          sourceChannel: "企业微信轻承接"
        }
      },
      include: {
        owner: true,
        sourceAttribution: true,
        followTasks: {
          orderBy: { createdAt: "desc" },
          take: 2
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 8
    })
  ]);

  const staffOptions = users.map((item) => ({
    value: item.id,
    label: `${item.name} / ${item.role}${item.wecomBinding?.wecomUserId ? ` / ${item.wecomBinding.wecomUserId}` : ""}`
  }));

  return (
    <PageShell
      tenant={tenant}
      title="企业微信轻承接测试台"
      breadcrumbs={[
        { label: "系统设置", href: `/app/${tenant.slug}/settings` },
        { label: "企业微信提醒配置", href: `/app/${tenant.slug}/wecom` },
        { label: "轻承接测试台" }
      ]}
      description="V2.6 只验证企业微信客户能被手工/模拟承接进 MarketClaw，并进入销售可跟进、可记录、可发资料、可设下一步动作的主流程。"
    >
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <Callout title="V2.6 边界" tone="amber">
            <BoundaryList />
          </Callout>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">承接配置状态</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>企微配置：{statusText(config?.status)}</p>
              <p>CorpId：{config?.corpId ? "已填写" : "未填写"}</p>
              <p>AgentId：{config?.agentId ? "已填写" : "未填写"}</p>
              <p>当前模板：{tenant.templateName ?? "未标注模板"}</p>
              <p>成员绑定：{users.filter((item) => item.wecomBinding?.wecomUserId).length} / {users.length}</p>
            </div>
            <Link className="mt-4 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" href={`/app/${tenant.slug}/wecom`}>
              返回企微配置
            </Link>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">V2.6-V2.8 三阶段规划</h2>
            <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
              <p><span className="font-medium text-slate-950">V2.6：</span>企业微信轻承接 MVP，手工/模拟导入客户，写来源，进跟进流程。</p>
              <p><span className="font-medium text-slate-950">V2.7：</span>补轻量承接批次、异常复盘和重复客户处理，不做聊天内容。</p>
              <p><span className="font-medium text-slate-950">V2.8：</span>在合规确认后评估有限 API 拉取客户基础信息，仍不做自动回复和会话存档。</p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">手工/模拟企微客户导入</h2>
            <form action={action} className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="客户姓名" name="contactName" required />
                <Input label="手机号" name="phone" required />
                <Input label="企业/实验室名称" name="company" />
                <Input label="企微外部联系人 ID（模拟）" name="externalUserId" />
                <Select label="承接成员" name="sourceStaffId" options={staffOptions} defaultValue={staffOptions[0]?.value} />
                <Input label="来源活动" name="sourceCampaign" defaultValue={isCnasTemplate ? "CNAS企微承接MVP" : "企微轻承接MVP"} />
                <Input label="来源场景" name="sourceScene" defaultValue="企业微信添加客户" />
                <Input label="来源二维码" name="sourceQrCode" />
              </div>

              {isCnasTemplate ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">CNAS 模板字段</p>
                  <p className="mt-1 text-sm text-slate-600">当前租户是 CNAS 试点模板，导入后会自动生成 CNAS 初步判断和跟进任务。</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Select label="实验室类型" name="labType" options={cnasLabTypeOptions} defaultValue="检测实验室" />
                    <Select label="当前阶段" name="currentStage" options={cnasCurrentStageOptions} defaultValue="刚开始了解" />
                    <Select label="认可范围是否明确" name="scopeClarity" options={cnasScopeClarityOptions} defaultValue="还不清楚" />
                    <Select label="人员设备是否基本具备" name="readiness" options={cnasReadinessOptions} defaultValue="不确定" />
                    <Select label="最担心的问题" name="primaryConcern" options={cnasPrimaryConcernOptions} defaultValue="不知道从哪开始" />
                    <Select label="计划启动时间" name="startPlan" options={cnasStartPlanOptions} defaultValue="只是先了解" />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <Select label="客户类型" name="customerType" options={customerTypeOptions} defaultValue={CustomerType.OTHER} />
                  <Select label="需求类型" name="needType" options={needTypeOptions} defaultValue={NeedType.OTHER} />
                  <Select label="意向等级" name="intentionLevel" options={intentionOptions} defaultValue={IntentionLevel.MEDIUM} />
                </div>
              )}

              <Textarea label="备注" name="message" rows={3} />
              <SubmitButton>模拟导入企微客户</SubmitButton>
            </form>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">最近轻承接客户</h2>
            <div className="mt-4 space-y-3">
              {recentLeads.length ? (
                recentLeads.map((lead) => (
                  <Link key={lead.id} className="block rounded-md border border-slate-200 p-4 hover:bg-slate-50" href={`/app/${tenant.slug}/leads/${lead.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">{lead.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{lead.company ?? "-"} / 负责人：{lead.owner?.name ?? "未分配"}</p>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{formatDate(lead.updatedAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {lead.sourceAttribution?.sourceProject ?? "-"} / {lead.sourceAttribution?.sourceScene ?? "-"} / {lead.sourceAttribution?.sourceStaffName ?? "-"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">最近任务：{lead.followTasks[0]?.title ?? "暂无任务"}</p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-500">暂无企业微信轻承接客户。可以先用上方表单模拟导入一条。</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
