"use client";

/*
 * 文件说明：该文件实现 Market Claw AI 测试沙盒的客户端交互表单。
 * 功能说明：负责提交沙盒生成动作、展示结构化建议结果，并支持把结果保存为训练样本草稿。
 *
 * 结构概览：
 *   第一部分：导入依赖与表单辅助组件
 *   第二部分：结果展示组件
 *   第三部分：AI 测试沙盒客户端表单
 */
import { useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { AiProvider } from "@prisma/client";
import type { MarketClawSandboxActionState } from "@/lib/market-claw-agents";
import { marketClawReplyRiskLevelLabels, marketClawSendModeLabels } from "@/lib/market-claw";

function ActionButton({
  children,
  pendingText,
  name,
  value,
  tone = "dark"
}: {
  children: React.ReactNode;
  pendingText: string;
  name?: string;
  value?: string;
  tone?: "dark" | "slate";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium ${
        tone === "dark" ? "bg-slate-950 text-white" : "border border-slate-300 bg-white text-slate-700"
      }`}
      disabled={pending}
      name={name}
      type="submit"
      value={value}
    >
      {pending ? pendingText : children}
    </button>
  );
}

function ResultBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm leading-6 text-slate-800">{value}</div>
    </div>
  );
}

function renderList(values: string[]) {
  if (!values.length) {
    return <p className="text-slate-500">-</p>;
  }
  return (
    <ul className="space-y-1">
      {values.map((item) => (
        <li key={item} className="rounded bg-white px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function MarketClawSandboxClient({
  tenantSlug,
  businessLineOptions,
  providerOptions,
  agentOptions,
  stageOptions,
  defaultProvider,
  generateAction,
  saveAction
}: {
  tenantSlug: string;
  businessLineOptions: Array<{ value: string; label: string }>;
  providerOptions: Array<{ value: AiProvider; label: string }>;
  agentOptions: Array<{ value: string; label: string }>;
  stageOptions: Array<{ value: string; label: string }>;
  defaultProvider: AiProvider;
  generateAction: (
    state: MarketClawSandboxActionState,
    formData: FormData
  ) => Promise<MarketClawSandboxActionState>;
  saveAction: (
    state: MarketClawSandboxActionState,
    formData: FormData
  ) => Promise<MarketClawSandboxActionState>;
}) {
  const [generateState, generateFormAction] = useFormState(generateAction, {
    status: "idle",
    message: null,
    result: null,
    savedTrainingCaseId: null
  });
  const [saveState, saveFormAction] = useFormState(saveAction, {
    status: "idle",
    message: null,
    result: null,
    savedTrainingCaseId: null
  });
  const visibleResult = saveState.result ?? generateState.result;
  const feedbackMessage = saveState.message ?? generateState.message;
  const savePayload = useMemo(
    () => (visibleResult ? JSON.stringify(visibleResult) : ""),
    [visibleResult]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="space-y-6">
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">输入客户问题，生成内部建议</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            这一步只做内部测试和训练，不会替销售直接对外回复，也不会自动写入正式知识库。
          </p>
          <form action={generateFormAction} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              客户问题
              <textarea
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                defaultValue=""
                name="customerQuestion"
                placeholder="例如：你们这个多久能见效？能不能保证效果？价格最低是多少？"
                required
                rows={5}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              业务线
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                defaultValue={businessLineOptions[0]?.value ?? ""}
                name="businessLineId"
              >
                {businessLineOptions.map((option) => (
                  <option key={option.value || "blank"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              AI Provider
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                defaultValue={defaultProvider}
                name="provider"
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              专家视角
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                defaultValue={agentOptions[0]?.value ?? "sales_coach"}
                name="agentId"
              >
                {agentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              客户阶段
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                defaultValue={stageOptions[0]?.value ?? "NEW"}
                name="customerStage"
              >
                {stageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-3">
              <ActionButton pendingText="正在生成建议...">生成建议</ActionButton>
              <ActionButton name="runMode" pendingText="正在生成 MOCK 建议..." tone="slate" value="mock">
                MOCK 测试
              </ActionButton>
            </div>
          </form>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">调用提示</h2>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            <p>如果当前租户没有启用真实 Provider，系统会安全降级并提示使用 MOCK。</p>
            <p>如果真实调用未返回合法 JSON，页面不会崩溃，会保留建议摘要并把风险默认收紧处理。</p>
            <p>调用日志只记录 Provider、Model、状态、耗时和摘要级信息，不记录完整 Prompt、完整输出和 API Key。</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">生成结果</h2>
              <p className="mt-1 text-sm text-slate-600">这里展示内部建议、风险等级、使用模式和下一步动作。</p>
            </div>
            {feedbackMessage ? (
              <span
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  (saveState.status || generateState.status) === "error"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {feedbackMessage}
              </span>
            ) : null}
          </div>

          {visibleResult ? (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ResultBlock label="专家名称" value={<p>{visibleResult.agentName}</p>} />
                <ResultBlock label="风险等级" value={<p>{marketClawReplyRiskLevelLabels[visibleResult.riskLevel]}（{visibleResult.riskLevel}）</p>} />
                <ResultBlock label="使用模式" value={<p>{marketClawSendModeLabels[visibleResult.sendMode]}（{visibleResult.sendMode}）</p>} />
                <ResultBlock
                  label="调用信息"
                  value={
                    <div className="space-y-1">
                      <p>{visibleResult.provider}</p>
                      <p>{visibleResult.model}</p>
                      <p>{visibleResult.callStatusText}</p>
                      <p>{visibleResult.latencyMs ?? "-"} ms</p>
                    </div>
                  }
                />
              </div>

              <ResultBlock label="摘要" value={<p>{visibleResult.summary}</p>} />
              {visibleResult.riskLevel === "HIGH" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  当前问题属于高风险边界，建议先确认条件和边界后再使用。
                </div>
              ) : null}
              {visibleResult.riskLevel === "BLOCKED" ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  当前问题只能作为内部建议，不建议直接发给客户。
                </div>
              ) : null}
              <ResultBlock label="推荐回复" value={<p className="whitespace-pre-wrap">{visibleResult.suggestedReply}</p>} />
              <ResultBlock label="微信简短回复" value={<p className="whitespace-pre-wrap">{visibleResult.wechatShortReply}</p>} />
              <ResultBlock label="建议追问" value={renderList(visibleResult.followUpQuestions)} />
              <ResultBlock label="风险原因" value={renderList(visibleResult.riskReasons)} />
              <ResultBlock label="下一步动作" value={renderList(visibleResult.nextActions)} />
              <ResultBlock
                label="知识沉淀建议"
                value={
                  <div className="space-y-1">
                    <p>是否建议沉淀：{visibleResult.knowledgeSuggestion.shouldSave ? "建议" : "暂不建议"}</p>
                    <p>沉淀类型：{visibleResult.knowledgeSuggestion.type}</p>
                    <p>建议标题：{visibleResult.knowledgeSuggestion.title}</p>
                    <p>原因：{visibleResult.knowledgeSuggestion.reason}</p>
                  </div>
                }
              />
              <ResultBlock label="内部备注" value={renderList(visibleResult.internalNotes)} />

              <form action={saveFormAction} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <input name="resultPayload" type="hidden" value={savePayload} />
                <input name="agentId" type="hidden" value={visibleResult.agentId} />
                <input name="businessLineId" type="hidden" value={visibleResult.businessLineId ?? ""} />
                <input name="customerStage" type="hidden" value={visibleResult.customerStage} />
                <input name="customerQuestion" type="hidden" value={visibleResult.customerQuestion} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">保存为训练样本草稿</p>
                    <p className="mt-1 text-sm text-slate-600">
                      保存后仍进入现有训练与知识治理流程，不会直接变成正式知识库内容。
                    </p>
                    {saveState.savedTrainingCaseId ? (
                      <p className="mt-2 text-xs text-emerald-700">
                        已创建训练草稿：{saveState.savedTrainingCaseId}。可前往
                        <a className="ml-1 underline" href={`/app/${tenantSlug}/market-claw/training`}>
                          训练场
                        </a>
                        查看。
                      </p>
                    ) : null}
                  </div>
                  <ActionButton pendingText="正在保存草稿...">保存为训练样本草稿</ActionButton>
                </div>
              </form>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              先输入客户问题并生成建议，这里会展示结构化结果、风险等级、使用模式和知识沉淀建议。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
