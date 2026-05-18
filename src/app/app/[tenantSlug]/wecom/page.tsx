/*
 * 文件说明：该文件实现 V2.1.3 企业微信内部工作提醒配置页。
 * 功能说明：支持企业微信基础配置、成员 ID 绑定、测试提醒和通知日志查看。
 *
 * 结构概览：
 *   第一部分：导入依赖与展示工具
 *   第二部分：配置、绑定和日志卡片
 *   第三部分：企业微信内部提醒配置页
 */
import { sendWecomTestNotification, upsertUserWecomBinding, upsertWeComConfig } from "@/lib/actions";
import { canManageTenantWeCom, canViewTenantWeComLogs, requireTenantAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildWecomConfigSummary,
  wecomNotificationEventTypeLabels,
  wecomNotificationStatusLabels
} from "@/lib/wecom";
import { PageShell } from "@/components/Shell";
import { Callout, Card, Input, Select, SubmitButton } from "@/components/Ui";

export const dynamic = "force-dynamic";

function formatDateTime(value?: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(value);
}

function StatusBadge({ status }: { status?: string | null }) {
  const tone =
    status === "SENT"
      ? "bg-emerald-50 text-emerald-700"
      : status === "FAILED"
        ? "bg-rose-50 text-rose-700"
        : status === "SKIPPED"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-700";
  return <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${tone}`}>{status ? wecomNotificationStatusLabels[status as keyof typeof wecomNotificationStatusLabels] ?? status : "-"}</span>;
}

export default async function WeComPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const canManage = canManageTenantWeCom(user.role);
  const canViewLogs = canViewTenantWeComLogs(user.role);

  const [config, users, logs, auditLog] = await Promise.all([
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
    canViewLogs
      ? prisma.wecomNotificationLog.findMany({
          where: { tenantId: tenant.id },
          include: { recipientUser: true },
          orderBy: { createdAt: "desc" },
          take: 20
        })
      : Promise.resolve([]),
    prisma.auditLog.findFirst({
      where: {
        tenantId: tenant.id,
        action: { in: ["wecom_config_tested", "wecom_internal_notification_failed", "wecom_internal_notification_skipped", "wecom_internal_notification_sent"] }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const summary = buildWecomConfigSummary(config ?? undefined);
  const configAction = upsertWeComConfig.bind(null, tenant.slug);
  const testAction = sendWecomTestNotification.bind(null, tenant.slug);

  return (
    <PageShell
      tenant={tenant}
      title="企业微信提醒配置"
      breadcrumbs={[
        { label: "业务配置", href: `/app/${tenant.slug}/business-lines` },
        { label: "企业微信提醒配置" }
      ]}
      description="当前仅用于企业内部工作提醒：系统事件把内部人员拉回系统处理，不处理客户侧沟通内容，也不做自动对外动作。"
    >
      <Callout title="本轮边界" tone="amber">
        当前只用于企业内部工作提醒。客户回复仍由销售自行确认，风险回复只是提醒确认边界，系统不会替销售做决定。没有配置或成员未绑定时，原有客户、任务和 Market Claw 流程不会受影响。
      </Callout>

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">配置状态</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <p>状态：{config?.status ?? "draft"}</p>
              <p>CorpId：{summary.hasCorpId ? "已配置" : "未配置"}</p>
              <p>AgentId：{summary.hasAgentId ? "已配置" : "未配置"}</p>
              <p>Secret：{summary.secretMasked}</p>
              <p>最近测试：{formatDateTime(config?.lastTestAt)}</p>
              <p className="flex items-center gap-2">最近测试状态：<StatusBadge status={config?.lastTestStatus} /></p>
              <p>最近测试说明：{config?.lastTestMessage ?? "-"}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">企业微信基础信息</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              页面不会回显完整 Secret。留空表示保留当前敏感字段；如需清空配置，可把状态改为 disabled，并重新保存非敏感字段。
            </p>
            <form action={configAction} className="mt-4 space-y-4">
              <Input label="CorpId" name="corpId" defaultValue={config?.corpId ?? ""} disabled={!canManage} />
              <Input label="AgentId" name="agentId" defaultValue={config?.agentId ?? ""} disabled={!canManage} />
              <Input label="Secret（保存后不完整回显）" name="secretEncrypted" defaultValue="" disabled={!canManage} />
              <Input label="Token（可选，留空保持原值）" name="token" defaultValue="" disabled={!canManage} />
              <Input label="EncodingAESKey（可选，留空保持原值）" name="encodingAESKey" defaultValue="" disabled={!canManage} />
              <Input label="CallbackUrl（可选）" name="callbackUrl" defaultValue={config?.callbackUrl ?? ""} disabled={!canManage} />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input disabled={!canManage} name="clearSensitiveConfig" type="checkbox" />
                <span>清空已保存的 Secret / Token / EncodingAESKey</span>
              </label>
              <Select
                label="启用状态"
                name="status"
                defaultValue={config?.status ?? "draft"}
                disabled={!canManage}
                options={[
                  { value: "draft", label: "draft：草稿" },
                  { value: "enabled", label: "enabled：启用内部提醒" },
                  { value: "disabled", label: "disabled：暂停" }
                ]}
              />
              {canManage ? <SubmitButton>保存企业微信提醒配置</SubmitButton> : <p className="text-sm text-slate-500">运营可查看配置状态，但不能修改敏感配置。</p>}
            </form>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">发送测试提醒</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              测试提醒只记录企业内部通知结果。当前版本未接入真实企业微信发送 API 时，会记录失败或跳过状态，页面不会崩溃。
            </p>
            <form action={testAction} className="mt-4 space-y-4">
              <Select
                label="接收人"
                name="recipientUserId"
                disabled={!canManage}
                options={users.map((item) => ({ value: item.id, label: `${item.name} / ${item.role}` }))}
                defaultValue={user.id}
              />
              {canManage ? <SubmitButton>发送测试提醒</SubmitButton> : <p className="text-sm text-slate-500">只有企业管理员可以发送配置测试提醒。</p>}
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">成员 ID 绑定</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              TENANT_ADMIN 可给系统用户绑定企业微信成员 ID；OPERATOR 只查看绑定状态。未绑定用户触发提醒时会记录 SKIPPED，不会阻断业务流程。
            </p>
            <div className="mt-4 space-y-4">
              {users.map((item) => (
                <form key={item.id} action={upsertUserWecomBinding.bind(null, tenant.slug, item.id)} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <div className="text-sm">
                      <p className="font-medium text-slate-950">{item.name}</p>
                      <p className="mt-1 text-slate-500">{item.email}</p>
                      <p className="mt-1 text-slate-500">{item.role}</p>
                    </div>
                    <Input label="企业微信成员 ID" name="wecomUserId" defaultValue={item.wecomBinding?.wecomUserId ?? ""} disabled={!canManage} />
                    <Input label="显示名称" name="displayName" defaultValue={item.wecomBinding?.displayName ?? item.name} disabled={!canManage} />
                    <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
                      <input defaultChecked={item.wecomBinding?.enabled ?? true} disabled={!canManage} name="enabled" type="checkbox" />
                      <span>启用</span>
                    </label>
                  </div>
                  {canManage ? <div className="mt-3"><SubmitButton>保存绑定</SubmitButton></div> : null}
                </form>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">最近提醒记录</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              通知日志只用于排查内部工作提醒是否送达、失败或跳过，不记录完整客户沟通内容，也不代表系统自动对客户动作。
            </p>
            <div className="mt-4 space-y-3">
              {logs.length ? (
                logs.map((log) => (
                  <div key={log.id} className="rounded-md border border-slate-200 p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">{log.title}</p>
                        <p className="mt-1 text-slate-500">
                          {wecomNotificationEventTypeLabels[log.eventType]} / 接收人：{log.recipientUser?.name ?? "未指定"}
                        </p>
                      </div>
                      <StatusBadge status={log.status} />
                    </div>
                    <p className="mt-2 text-slate-600">{log.content}</p>
                    {log.errorMessage ? <p className="mt-2 text-rose-700">失败/跳过原因：{log.errorMessage}</p> : null}
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                      <p>创建：{formatDateTime(log.createdAt)}</p>
                      <p>发送：{formatDateTime(log.sentAt)}</p>
                      <p>关联客户：{log.relatedLeadId ?? "-"}</p>
                      <p>关联任务：{log.relatedTaskId ?? "-"}</p>
                      <p>关联训练：{log.relatedTrainingCaseId ?? "-"}</p>
                      <p>关联候选：{log.relatedCandidateId ?? "-"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">暂无提醒记录。保存配置并发送测试提醒后，这里会显示 SENT、FAILED 或 SKIPPED 结果。</p>
              )}
            </div>
            {auditLog ? <p className="mt-4 text-xs text-slate-500">最近企业微信审计动作：{auditLog.action}</p> : null}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
