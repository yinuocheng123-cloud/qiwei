/*
 * 文件说明：该文件提供 V2.1.5 AI Provider 基础配置与安全调用框架。
 * 功能说明：负责租户级 AI 配置读取、API Key 掩码、DeepSeek/OpenAI-compatible 最小调用、调用日志和安全降级。
 *
 * 结构概览：
 *   第一部分：类型、标签与掩码工具
 *   第二部分：配置读取与调用日志
 *   第三部分：Chat Completions 安全调用
 *   第四部分：测试连接、文本调用与 JSON 调用
 */
import crypto from "crypto";
import { AiCallPurpose, AiCallStatus, AiProvider, type Prisma } from "@prisma/client";
import { safeWriteAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const aiProviderLabels: Record<AiProvider, string> = {
  DEEPSEEK: "DeepSeek",
  OPENAI_COMPATIBLE: "OpenAI-compatible",
  MOCK: "Mock 测试通道"
};

export const aiCallStatusLabels: Record<AiCallStatus, string> = {
  SUCCESS: "成功",
  FAILED: "失败",
  SKIPPED: "已跳过"
};

export const aiCallPurposeLabels: Record<AiCallPurpose, string> = {
  TEST_CONNECTION: "测试连接",
  KNOWLEDGE_INGESTION_PREVIEW: "资料投喂预览",
  MARKET_CLAW_SANDBOX: "Market Claw 沙盒",
  AGENT_LIBRARY_TEST: "Agent Library 测试",
  REPLY_DRAFT_PREVIEW: "回复草稿预览",
  TRAINING_PREVIEW: "训练预览"
};

export function maskApiKey(value?: string | null) {
  if (!value) return "未配置";
  if (value.length <= 8) return "已配置";
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

export function normalizeAiBaseUrl(value?: string | null) {
  const fallback = "https://api.deepseek.com";
  const next = value?.trim() || fallback;
  return next.endsWith("/") ? next.slice(0, -1) : next;
}

export function getChatCompletionsUrl(baseUrl: string) {
  const normalized = normalizeAiBaseUrl(baseUrl);
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
}

function truncate(value: string, maxLength = 120) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function hashText(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

type RecordAiCallInput = {
  tenantId: string;
  createdById?: string | null;
  provider: AiProvider;
  model: string;
  purpose: AiCallPurpose;
  status: AiCallStatus;
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
  promptHash?: string | null;
};

export async function getTenantAiProviderConfig(tenantId: string) {
  return prisma.aiProviderConfig.findUnique({ where: { tenantId } });
}

export async function recordAiCallLog(input: RecordAiCallInput) {
  const log = await prisma.aiCallLog.create({
    data: {
      tenantId: input.tenantId,
      provider: input.provider,
      model: input.model,
      purpose: input.purpose,
      status: input.status,
      errorMessage: input.errorMessage ? truncate(input.errorMessage, 300) : null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      latencyMs: input.latencyMs ?? null,
      createdById: input.createdById ?? null
    }
  });

  const metadata: Prisma.InputJsonValue = {
    tenantId: input.tenantId,
    provider: input.provider,
    model: input.model,
    purpose: input.purpose,
    status: input.status,
    latencyMs: input.latencyMs ?? null,
    createdById: input.createdById ?? null,
    promptHash: input.promptHash ?? null,
    errorMessage: input.errorMessage ? truncate(input.errorMessage, 120) : null
  };

  await safeWriteAuditLog({
    tenantId: input.tenantId,
    userId: input.createdById ?? undefined,
    action:
      input.status === AiCallStatus.SUCCESS
        ? "ai_provider_call_succeeded"
        : input.status === AiCallStatus.SKIPPED
          ? "ai_provider_call_skipped"
          : "ai_provider_call_failed",
    entityType: "AiCallLog",
    entityId: log.id,
    metadata
  });

  return log;
}

type AiCompletionResult = {
  ok: boolean;
  status: AiCallStatus;
  text?: string;
  data?: unknown;
  errorMessage?: string;
  latencyMs?: number;
  logId?: string;
};

type CompletionInput = {
  tenantId: string;
  createdById?: string | null;
  purpose: AiCallPurpose;
  prompt: string;
  systemPrompt?: string;
  expectJson?: boolean;
};

async function safeCallChatCompletions(input: CompletionInput): Promise<AiCompletionResult> {
  const config = await getTenantAiProviderConfig(input.tenantId);
  const provider = config?.provider ?? AiProvider.DEEPSEEK;
  const model = config?.model ?? "deepseek-chat";
  const promptHash = hashText(`${input.systemPrompt ?? ""}\n${input.prompt}`);
  const startedAt = Date.now();

  if (!config || !config.enabled) {
    const log = await recordAiCallLog({
      tenantId: input.tenantId,
      createdById: input.createdById,
      provider,
      model,
      purpose: input.purpose,
      status: AiCallStatus.SKIPPED,
      errorMessage: "AI Provider 未配置或未启用，系统继续使用规则版能力。",
      latencyMs: 0,
      promptHash
    });
    return { ok: false, status: AiCallStatus.SKIPPED, errorMessage: log.errorMessage ?? undefined, logId: log.id };
  }

  if (config.provider === AiProvider.MOCK) {
    const latencyMs = Date.now() - startedAt;
    const log = await recordAiCallLog({
      tenantId: input.tenantId,
      createdById: input.createdById,
      provider: config.provider,
      model: config.model,
      purpose: input.purpose,
      status: AiCallStatus.SUCCESS,
      latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      promptHash
    });
    return { ok: true, status: AiCallStatus.SUCCESS, text: "AI 配置已连通。", latencyMs, logId: log.id };
  }

  if (!config.apiKeyEncrypted) {
    const latencyMs = Date.now() - startedAt;
    const log = await recordAiCallLog({
      tenantId: input.tenantId,
      createdById: input.createdById,
      provider: config.provider,
      model: config.model,
      purpose: input.purpose,
      status: AiCallStatus.FAILED,
      errorMessage: "AI Provider 已启用，但 API Key 未配置。",
      latencyMs,
      promptHash
    });
    return { ok: false, status: AiCallStatus.FAILED, errorMessage: log.errorMessage ?? undefined, latencyMs, logId: log.id };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(getChatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKeyEncrypted}`
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        messages: [
          ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
          { role: "user", content: input.prompt }
        ],
        ...(input.expectJson ? { response_format: { type: "json_object" } } : {})
      }),
      signal: controller.signal
    });
    const latencyMs = Date.now() - startedAt;
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = body?.error?.message ?? `AI Provider 请求失败：HTTP ${response.status}`;
      const log = await recordAiCallLog({
        tenantId: input.tenantId,
        createdById: input.createdById,
        provider: config.provider,
        model: config.model,
        purpose: input.purpose,
        status: AiCallStatus.FAILED,
        errorMessage,
        latencyMs,
        promptHash
      });
      return { ok: false, status: AiCallStatus.FAILED, errorMessage: truncate(errorMessage), latencyMs, logId: log.id };
    }

    const text = body?.choices?.[0]?.message?.content ?? "";
    const usage = body?.usage ?? {};
    const log = await recordAiCallLog({
      tenantId: input.tenantId,
      createdById: input.createdById,
      provider: config.provider,
      model: config.model,
      purpose: input.purpose,
      status: AiCallStatus.SUCCESS,
      latencyMs,
      promptTokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : null,
      completionTokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : null,
      totalTokens: typeof usage.total_tokens === "number" ? usage.total_tokens : null,
      promptHash
    });
    return { ok: true, status: AiCallStatus.SUCCESS, text, data: body, latencyMs, logId: log.id };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : "AI Provider 调用失败。";
    const log = await recordAiCallLog({
      tenantId: input.tenantId,
      createdById: input.createdById,
      provider: config.provider,
      model: config.model,
      purpose: input.purpose,
      status: AiCallStatus.FAILED,
      errorMessage,
      latencyMs,
      promptHash
    });
    return { ok: false, status: AiCallStatus.FAILED, errorMessage: truncate(errorMessage), latencyMs, logId: log.id };
  } finally {
    clearTimeout(timeout);
  }
}

export async function testAiProviderConnection(input: { tenantId: string; createdById?: string | null }) {
  return safeCallChatCompletions({
    tenantId: input.tenantId,
    createdById: input.createdById,
    purpose: AiCallPurpose.TEST_CONNECTION,
    prompt: "请返回一句简短的测试回复：AI 配置已连通。",
    systemPrompt: "你只用于系统内部低风险连通性测试。"
  });
}

export async function callAiTextCompletion(input: CompletionInput) {
  return safeCallChatCompletions({ ...input, expectJson: false });
}

export async function callAiJsonCompletion(input: CompletionInput) {
  const result = await safeCallChatCompletions({ ...input, expectJson: true });
  if (!result.ok || !result.text) return { ...result, json: null };

  try {
    return { ...result, json: JSON.parse(result.text) };
  } catch {
    return {
      ...result,
      ok: false,
      status: AiCallStatus.FAILED,
      json: null,
      errorMessage: "AI 返回内容不是有效 JSON，已安全降级。"
    };
  }
}
