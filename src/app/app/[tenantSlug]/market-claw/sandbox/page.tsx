/*
 * 文件说明：该页面实现 V2.1.7 的 Market Claw AI 测试沙盒。
 * 功能说明：允许企业管理员和运营输入客户问题，选择业务线、Provider、专家视角和客户阶段，生成内部 AI 建议并保存为训练样本草稿。
 *
 * 结构概览：
 *   第一部分：导入依赖与选项准备
 *   第二部分：AI 测试沙盒页面
 */
import { AiProvider } from "@prisma/client";
import { MarketClawSandboxClient } from "@/components/MarketClawSandboxClient";
import { PageShell } from "@/components/Shell";
import { Callout, SectionTabs } from "@/components/Ui";
import { generateMarketClawSandboxAdvice, saveMarketClawSandboxTrainingDraft } from "@/lib/actions";
import { canAccessMarketClawSandbox, requireTenantAccess } from "@/lib/auth";
import {
  marketClawSandboxAgentProfiles,
  marketClawSandboxStageOptions
} from "@/lib/market-claw-agents";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function buildOverviewTabs(tenantSlug: string) {
  return [
    { key: "overview", label: "总览", href: `/app/${tenantSlug}/market-claw` },
    { key: "knowledge", label: "知识库", href: `/app/${tenantSlug}/market-claw/knowledge` },
    { key: "ingestion", label: "资料投喂", href: `/app/${tenantSlug}/market-claw/ingestion` },
    { key: "training", label: "回复训练场", href: `/app/${tenantSlug}/market-claw/training` },
    { key: "review", label: "训练审核", href: `/app/${tenantSlug}/market-claw/training/review` },
    { key: "insights", label: "训练复盘", href: `/app/${tenantSlug}/market-claw/insights` },
    { key: "replies", label: "回复记录", href: `/app/${tenantSlug}/market-claw/replies` },
    { key: "sandbox", label: "AI 测试沙盒", href: `/app/${tenantSlug}/market-claw/sandbox` }
  ];
}

export default async function MarketClawSandboxPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canAccessMarketClawSandbox(user.role)) {
    return null;
  }

  const [businessLines, aiConfig, sandboxLogs] = await Promise.all([
    prisma.businessLine.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      select: { id: true, name: true }
    }),
    prisma.aiProviderConfig.findUnique({ where: { tenantId: tenant.id } }),
    prisma.aiCallLog.findMany({
      where: { tenantId: tenant.id, purpose: "MARKET_CLAW_SANDBOX" },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);

  const providerOptions = [
    { value: AiProvider.DEEPSEEK, label: "DEEPSEEK" },
    { value: AiProvider.DOUBAO, label: "DOUBAO" },
    { value: AiProvider.OPENAI_COMPATIBLE, label: "OPENAI_COMPATIBLE" },
    { value: AiProvider.MOCK, label: "MOCK" }
  ];
  const defaultProvider = aiConfig?.enabled ? aiConfig.provider : AiProvider.MOCK;
  const businessLineOptions = [
    { value: "", label: "不绑定业务线，按通用问题测试" },
    ...businessLines.map((item) => ({ value: item.id, label: item.name }))
  ];
  const agentOptions = marketClawSandboxAgentProfiles.map((item) => ({
    value: item.id,
    label: `${item.name}｜${item.description}`
  }));

  return (
    <PageShell
      tenant={tenant}
      title="AI 测试沙盒"
      breadcrumbs={[
        { label: "Market Claw", href: `/app/${tenant.slug}/market-claw` },
        { label: "AI 测试沙盒" }
      ]}
      description="这是 Market Claw 的内部测试和训练页面，用于验证 AI Provider、专家视角、风险分级和训练草稿保存闭环。"
    >
      <SectionTabs className="mb-4" current="sandbox" items={buildOverviewTabs(tenant.slug)} />

      <Callout title="内部使用边界" tone="amber">
        <div className="space-y-1">
          <p>这是内部测试和训练页面。</p>
          <p>AI 输出只是建议，不会直接写入正式知识库。</p>
          <p>不会替销售对外回复，客户回复仍需销售确认。</p>
          <p>风险等级仍以系统规则和人工确认优先，不会因为 AI 建议而自动降低边界。</p>
          <p>没有配置真实 AI 时，系统仍可用 MOCK 生成结构化建议，继续测试流程。</p>
        </div>
      </Callout>

      <div className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">当前可用 Provider 提示</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-slate-700">
          <p className="rounded-md bg-slate-50 px-3 py-2">当前租户启用 Provider：{aiConfig?.enabled ? aiConfig.provider : "未启用真实 Provider"}</p>
          <p className="rounded-md bg-slate-50 px-3 py-2">当前 Model：{aiConfig?.model ?? "未配置"}</p>
          <p className="rounded-md bg-slate-50 px-3 py-2">豆包 / 火山方舟参考地址：https://ark.cn-beijing.volces.com/api/v3</p>
          <p className="rounded-md bg-slate-50 px-3 py-2">最近沙盒调用：{sandboxLogs.length} 次</p>
        </div>
      </div>

      <div className="mt-6">
        <MarketClawSandboxClient
          agentOptions={agentOptions}
          businessLineOptions={businessLineOptions}
          defaultProvider={defaultProvider}
          generateAction={generateMarketClawSandboxAdvice.bind(null, tenant.slug)}
          providerOptions={providerOptions}
          saveAction={saveMarketClawSandboxTrainingDraft.bind(null, tenant.slug)}
          stageOptions={marketClawSandboxStageOptions}
          tenantSlug={tenant.slug}
        />
      </div>

      <div className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">最近沙盒调用摘要</h2>
        <div className="mt-4 space-y-3">
          {sandboxLogs.length ? (
            sandboxLogs.map((log) => (
              <div key={log.id} className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-950">
                  {log.provider} / {log.model}
                </p>
                <p className="mt-1">状态：{log.status}</p>
                <p className="mt-1">用途：{log.purpose}</p>
                <p className="mt-1">耗时：{log.latencyMs ?? "-"} ms</p>
                <p className="mt-1">错误摘要：{log.errorMessage ?? "-"}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">还没有沙盒调用记录。可以先用 MOCK 跑一轮结构化建议。</p>
          )}
        </div>
      </div>
    </PageShell>
  );
}
