/*
 * 文件说明：该页面实现 V2.1.5 AI Provider 基础配置入口。
 * 功能说明：支持 DeepSeek / OpenAI-compatible 配置、API Key 掩码、安全测试、调用日志和权限边界说明。
 *
 * 结构概览：
 *   第一部分：导入依赖与展示工具
 *   第二部分：配置状态、表单和日志展示
 *   第三部分：AI 能力配置页面
 */
import { AiProvider, type AiCallStatus } from "@prisma/client";
import { clearAiProviderConfig, testTenantAiProviderConfig, upsertAiProviderConfig } from "@/lib/actions";
import { canManageTenantAiSettings, canTestTenantAiSettings, requireTenantAccess } from "@/lib/auth";
import {
  aiCallPurposeLabels,
  aiCallStatusLabels,
  aiProviderLabels,
  getDefaultAiBaseUrl,
  getDefaultAiModel,
  maskApiKey
} from "@/lib/ai-provider";
import { prisma } from "@/lib/prisma";
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

function StatusBadge({ status }: { status?: AiCallStatus | null }) {
  const tone =
    status === "SUCCESS"
      ? "bg-emerald-50 text-emerald-700"
      : status === "FAILED"
        ? "bg-rose-50 text-rose-700"
        : status === "SKIPPED"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-700";
  return <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${tone}`}>{status ? aiCallStatusLabels[status] : "-"}</span>;
}

export default async function AiSettingsPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const canManage = canManageTenantAiSettings(user.role);
  const canTest = canTestTenantAiSettings(user.role);

  const [config, logs, auditLog] = await Promise.all([
    prisma.aiProviderConfig.findUnique({ where: { tenantId: tenant.id } }),
    prisma.aiCallLog.findMany({
      where: { tenantId: tenant.id },
      include: { createdBy: true },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.auditLog.findFirst({
      where: {
        tenantId: tenant.id,
        action: { in: ["ai_provider_config_tested", "ai_provider_call_failed", "ai_provider_call_skipped", "ai_provider_call_succeeded"] }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const saveAction = upsertAiProviderConfig.bind(null, tenant.slug);
  const testAction = testTenantAiProviderConfig.bind(null, tenant.slug);
  const clearAction = clearAiProviderConfig.bind(null, tenant.slug);
  const activeProvider = config?.provider ?? AiProvider.DEEPSEEK;
  const defaultBaseUrl = getDefaultAiBaseUrl(activeProvider);
  const defaultModel = getDefaultAiModel(activeProvider);

  return (
    <PageShell
      tenant={tenant}
      title="AI 能力配置"
      breadcrumbs={[
        { label: "业务配置", href: `/app/${tenant.slug}/business-lines` },
        { label: "AI 能力配置" }
      ]}
      description="配置租户级 AI Provider，用于系统内部辅助生成、测试沙盒和后续 Agent Library 调用预留。"
    >
      <Callout title="安全边界" tone="amber">
        AI 输出只是建议，候选知识仍需人工审核，客户回复仍由销售确认，风险等级仍以 V2.1.2 的系统规则和人工确认优先。没有配置 AI 时，系统继续使用规则版能力；本轮不改 Market Claw 主链路，不让 AI 直接写业务数据，也不做自动对外动作。
      </Callout>

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">当前配置状态</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-700">
              <p>Provider：{config ? aiProviderLabels[config.provider] : "未配置"}</p>
              <p>Base URL：{config?.baseUrl ?? "https://api.deepseek.com"}</p>
              <p>模型：{config?.model ?? "deepseek-chat"}</p>
              <p>API Key：{maskApiKey(config?.apiKeyEncrypted)}</p>
              <p>启用状态：{config?.enabled ? "已启用" : "未启用"}</p>
              <p>Temperature：{config?.temperature ?? 0.2}</p>
              <p>Max Tokens：{config?.maxTokens ?? 512}</p>
              <p>最近测试：{formatDateTime(config?.lastTestAt)}</p>
              <p className="flex items-center gap-2">最近测试状态：<StatusBadge status={config?.lastTestStatus} /></p>
              <p>最近测试说明：{config?.lastTestMessage ?? "-"}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">Provider 配置</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              DeepSeek API 使用 OpenAI-compatible Chat Completions 格式。模型名称不写死，请按后台配置和官方文档维护。页面不会回显完整 API Key，留空表示保留当前密钥。
            </p>
            <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm leading-6 text-sky-900">
              <p>豆包 / 火山方舟按 OpenAI-compatible Chat Completions 接入，默认 Base URL 可使用 https://ark.cn-beijing.volces.com/api/v3。</p>
              <p>当前 Provider 的默认参考值：{defaultBaseUrl} / {defaultModel}。</p>
              <p>模型 ID 和 API Key 以火山方舟控制台实际开通结果为准；系统只保存配置并复用统一调用服务，不新增自动对外动作。</p>
            </div>
            <form action={saveAction} className="mt-4 space-y-4">
              <Select
                label="Provider"
                name="provider"
                defaultValue={config?.provider ?? AiProvider.DEEPSEEK}
                disabled={!canManage}
                options={[
                  { value: AiProvider.DEEPSEEK, label: "DEEPSEEK" },
                  { value: AiProvider.DOUBAO, label: "DOUBAO / 豆包火山方舟" },
                  { value: AiProvider.OPENAI_COMPATIBLE, label: "OPENAI_COMPATIBLE" },
                  { value: AiProvider.MOCK, label: "MOCK" }
                ]}
              />
              <Input label="Base URL" name="baseUrl" defaultValue={config?.baseUrl ?? "https://api.deepseek.com"} disabled={!canManage} />
              <Input label="Model" name="model" defaultValue={config?.model ?? "deepseek-chat"} disabled={!canManage} />
              <Input label="API Key（保存后不完整回显）" name="apiKeyEncrypted" defaultValue="" disabled={!canManage} />
              <Input label="Temperature" name="temperature" defaultValue={String(config?.temperature ?? 0.2)} disabled={!canManage} />
              <Input label="Max Tokens" name="maxTokens" defaultValue={String(config?.maxTokens ?? 512)} disabled={!canManage} />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input defaultChecked={config?.enabled ?? false} disabled={!canManage} name="enabled" type="checkbox" />
                <span>启用 AI Provider</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input disabled={!canManage} name="clearApiKey" type="checkbox" />
                <span>清空已保存 API Key</span>
              </label>
              {canManage ? <SubmitButton>保存 AI 配置</SubmitButton> : <p className="text-sm text-slate-500">OPERATOR 可查看配置状态和执行测试，但不能修改完整配置或清空密钥。</p>}
            </form>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">测试连接与清空配置</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              测试请求使用固定低风险内容：“请返回一句简短的测试回复：AI 配置已连通。” 无真实 API Key 或网络不可用时会记录 FAILED 或 SKIPPED，页面不会崩溃。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <form action={testAction}>
                {canTest ? <SubmitButton>发送测试请求</SubmitButton> : null}
              </form>
              <form action={clearAction}>
                {canManage ? <SubmitButton>清空配置并暂停</SubmitButton> : null}
              </form>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">当前能力边界</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                "当前仅用于系统内部辅助生成和测试。",
                "AI 输出只是建议。",
                "候选知识仍需人工审核。",
                "客户回复仍由销售确认。",
                "风险等级仍受 V2.1.2 规则约束。",
                "没有配置 AI 时，系统继续使用规则版能力。",
                "不让 AI 直接写入正式知识库。",
                "不让 AI 直接执行系统动作。"
              ].map((item) => (
                <p key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{item}</p>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">最近调用日志</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              调用日志只记录结构化信息、状态、耗时和 token 用量，不记录完整 prompt，不记录完整 AI 输出，也不记录完整 API Key。
            </p>
            <div className="mt-4 space-y-3">
              {logs.length ? (
                logs.map((log) => (
                  <div key={log.id} className="rounded-md border border-slate-200 p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">{aiCallPurposeLabels[log.purpose]} / {aiProviderLabels[log.provider]}</p>
                        <p className="mt-1 text-slate-500">模型：{log.model} / 操作人：{log.createdBy?.name ?? "-"}</p>
                      </div>
                      <StatusBadge status={log.status} />
                    </div>
                    {log.errorMessage ? <p className="mt-2 text-rose-700">失败/跳过原因：{log.errorMessage}</p> : null}
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-4">
                      <p>创建：{formatDateTime(log.createdAt)}</p>
                      <p>耗时：{log.latencyMs ?? "-"} ms</p>
                      <p>Prompt Tokens：{log.promptTokens ?? "-"}</p>
                      <p>Total Tokens：{log.totalTokens ?? "-"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">暂无调用日志。保存配置并执行测试后，这里会显示 SUCCESS、FAILED 或 SKIPPED 结果。</p>
              )}
            </div>
            {auditLog ? <p className="mt-4 text-xs text-slate-500">最近 AI 审计动作：{auditLog.action}</p> : null}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
