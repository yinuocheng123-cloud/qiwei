/*
 * 文件说明：该页面实现 V1.9.1 沟通素材合规采集配置中心。
 * 功能说明：允许企业管理员在开通收费采集能力前完成申请、合规确认、采集范围、保留策略与 AI 使用边界配置；运营仅只读查看。
 *
 * 结构概览：
 *   第一部分：导入依赖与静态选项
 *   第二部分：通用展示与表单辅助组件
 *   第三部分：单通道配置卡片
 *   第四部分：沟通素材合规采集配置页面
 */
import {
  CommunicationComplianceChannel,
  CommunicationComplianceProvider,
  CommunicationComplianceStatus
} from "@prisma/client";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";
import { upsertCommunicationComplianceConfig } from "@/lib/actions";
import { canManageCommunicationCompliance, requireTenantAccess } from "@/lib/auth";
import { labelOf } from "@/lib/options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CommunicationComplianceConfigItem = Awaited<ReturnType<typeof prisma.communicationComplianceConfig.findMany>>[number];

type ScopeConfig = {
  employeeScopeMode?: string;
  employeeScopeUsers?: string[];
  businessLineScopeMode?: string;
  businessLineScopeIds?: string[];
  customerScopeMode?: string;
  customerScopeTags?: string[];
  customerScopeBusinessLines?: string[];
  customerScopeSources?: string[];
  excludePausedOrArchivedBusinessLines?: boolean;
};

type NoticeConfig = {
  featureApplicationRequired?: boolean;
  featureApplicationSubmitted?: boolean;
  enterpriseAware?: boolean;
  employeeNoticeConfirmed?: boolean;
  customerNoticeConfirmed?: boolean;
  usageScopeConfirmed?: boolean;
  noUnauthorizedMonitoring?: boolean;
  aiAssistOnlyConfirmed?: boolean;
  customerNoticeRequired?: boolean;
  recordingConsentConfirmed?: boolean;
  customerNoticeTemplate?: string;
  internalNoticeNotes?: string;
};

type RetentionConfig = {
  dataRetentionDays?: number;
  keepRawText?: boolean;
  keepSummaryOnly?: boolean;
  keepAudioFile?: boolean;
  keepTranscriptOnly?: boolean;
};

type AiConfig = {
  allowAiSummary?: boolean;
  allowAiTagSuggestion?: boolean;
  allowAiTaskSuggestion?: boolean;
  allowReplySuggestion?: boolean;
  allowAiAnalysis?: boolean;
  allowTranscription?: boolean;
  allowAudioUpload?: boolean;
  allowAutoTranscription?: boolean;
  allowAutoSend?: boolean;
};

type ChannelDefinition = {
  channel: CommunicationComplianceChannel;
  title: string;
  summary: string;
  providerOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  featureHint: string;
  currentNote: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

const statusOptions = [
  { value: CommunicationComplianceStatus.DISABLED, label: "未启用" },
  { value: CommunicationComplianceStatus.APPLYING, label: "申请中" },
  { value: CommunicationComplianceStatus.ENABLED, label: "已启用" },
  { value: CommunicationComplianceStatus.PAUSED, label: "已暂停" },
  { value: CommunicationComplianceStatus.ARCHIVED, label: "已归档" }
];

const employeeScopeOptions = [
  { value: "ALL", label: "全部员工" },
  { value: "SPECIFIC_USERS", label: "指定员工" },
  { value: "PLACEHOLDER", label: "暂不指定，仅占位" }
];

const businessLineScopeOptions = [
  { value: "ALL_ACTIVE", label: "全部启用业务线" },
  { value: "SPECIFIC_LINES", label: "指定业务线" },
  { value: "PLACEHOLDER", label: "暂不指定，仅占位" }
];

const customerScopeOptions = [
  { value: "ALL", label: "全部客户" },
  { value: "TAGGED", label: "指定标签客户" },
  { value: "BUSINESS_LINE", label: "指定业务线客户" },
  { value: "SOURCE", label: "指定来源客户" }
];

const channelDefinitions: ChannelDefinition[] = [
  {
    channel: CommunicationComplianceChannel.WECHAT_ARCHIVE,
    title: "企业微信会话存档采集",
    summary: "用于未来对接企业微信会话存档或工作沟通留痕 provider，但当前版本只做申请、合规和范围配置。",
    providerOptions: [
      { value: CommunicationComplianceProvider.MANUAL, label: "手动模式" },
      { value: CommunicationComplianceProvider.WECHAT_ARCHIVE_PLACEHOLDER, label: "企业微信会话存档占位" },
      { value: CommunicationComplianceProvider.OTHER, label: "其他 provider" }
    ],
    statusOptions,
    featureHint: "该能力为单独收费功能，必须先申请开通，再进入申请中或启用状态。",
    currentNote: "当前版本不接企业微信 API，不自动读取聊天，不自动发送客户消息。"
  },
  {
    channel: CommunicationComplianceChannel.PHONE_RECORDING,
    title: "电话录音采集",
    summary: "用于未来接入电话录音系统的前置合规配置，当前只做收费申请、范围和保留策略设置。",
    providerOptions: [
      { value: CommunicationComplianceProvider.MANUAL, label: "手动模式" },
      { value: CommunicationComplianceProvider.PHONE_SYSTEM_PLACEHOLDER, label: "电话系统占位" },
      { value: CommunicationComplianceProvider.OTHER, label: "其他 provider" }
    ],
    statusOptions,
    featureHint: "该能力为单独收费功能，必须先申请开通，并确认录音告知与客户提示责任。",
    currentNote: "当前版本不接电话线路、不读取真实电话录音。"
  },
  {
    channel: CommunicationComplianceChannel.ASR_TRANSCRIPTION,
    title: "语音转文字服务",
    summary: "用于未来接入语音转写 provider 的前置配置，当前版本只记录上传、转写与保留策略边界。",
    providerOptions: [
      { value: CommunicationComplianceProvider.MANUAL, label: "手动模式" },
      { value: CommunicationComplianceProvider.ASR_PROVIDER_PLACEHOLDER, label: "ASR 服务占位" },
      { value: CommunicationComplianceProvider.OTHER, label: "其他 provider" }
    ],
    statusOptions,
    featureHint: "该能力为单独收费功能，必须先申请开通，当前仅做配置中心，不接真实 ASR。",
    currentNote: "当前版本不接 ASR 服务，不自动转写真实录音。"
  }
];

const leadSourceOptions = [
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "shipinhao", label: "视频号" },
  { value: "gongzhonghao", label: "公众号" },
  { value: "website", label: "官网" },
  { value: "friend_circle", label: "朋友圈" },
  { value: "offline_event", label: "线下活动" },
  { value: "referral", label: "转介绍" },
  { value: "imported", label: "导入" },
  { value: "other", label: "其他" }
];

function parseJsonObject<T extends object>(value: unknown, fallback: T) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  return { ...fallback, ...(value as Partial<T>) };
}

function pickSearchValue(searchParams: SearchParams, key: string) {
  return typeof searchParams[key] === "string" ? (searchParams[key] as string) : "";
}

function CheckboxRow({
  name,
  label,
  defaultChecked,
  disabled = false,
  description
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-md border px-3 py-3 text-sm ${disabled ? "border-slate-200 bg-slate-50 text-slate-500" : "border-slate-200 text-slate-700"}`}>
      <input defaultChecked={defaultChecked} disabled={disabled} name={name} type="checkbox" />
      <span>
        <span className="block font-medium">{label}</span>
        {description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}

function MultiCheckboxGroup({
  title,
  name,
  options,
  selectedValues,
  disabled = false,
  helperText
}: {
  title: string;
  name: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  disabled?: boolean;
  helperText?: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {helperText ? <p className="mt-1 text-xs text-slate-500">{helperText}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${disabled ? "border-slate-200 bg-slate-50 text-slate-500" : "border-slate-200 text-slate-700"}`}
          >
            <input defaultChecked={selectedValues.includes(option.value)} disabled={disabled} name={name} type="checkbox" value={option.value} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function MultiValueTextarea({
  label,
  name,
  values,
  disabled = false,
  helperText
}: {
  label: string;
  name: string;
  values: string[];
  disabled?: boolean;
  helperText?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {helperText ? <span className="mt-1 block text-xs font-normal text-slate-500">{helperText}</span> : null}
      <textarea
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
        name={name}
        rows={4}
        defaultValue={values.join("\n")}
        disabled={disabled}
      />
    </label>
  );
}

function ChannelStatusBadge({ status }: { status: CommunicationComplianceStatus }) {
  const toneClassName =
    status === CommunicationComplianceStatus.ENABLED
      ? "bg-emerald-50 text-emerald-700"
      : status === CommunicationComplianceStatus.APPLYING
        ? "bg-amber-50 text-amber-700"
        : status === CommunicationComplianceStatus.PAUSED
          ? "bg-slate-200 text-slate-700"
          : "bg-slate-100 text-slate-600";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClassName}`}>{labelOf(statusOptions, status)}</span>;
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function ComplianceChannelCard({
  tenantSlug,
  channelDefinition,
  config,
  canManage,
  messageType,
  messageText,
  businessLines,
  users
}: {
  tenantSlug: string;
  channelDefinition: ChannelDefinition;
  config?: CommunicationComplianceConfigItem;
  canManage: boolean;
  messageType?: "success" | "error";
  messageText?: string;
  businessLines: { id: string; name: string; slug: string; status: string }[];
  users: { id: string; name: string; role: string }[];
}) {
  const scopeConfig = parseJsonObject<ScopeConfig>(config?.scopeConfig, {
    employeeScopeMode: "ALL",
    employeeScopeUsers: [],
    businessLineScopeMode: "ALL_ACTIVE",
    businessLineScopeIds: [],
    customerScopeMode: "ALL",
    customerScopeTags: [],
    customerScopeBusinessLines: [],
    customerScopeSources: [],
    excludePausedOrArchivedBusinessLines: true
  });
  const noticeConfig = parseJsonObject<NoticeConfig>(config?.noticeConfig, {
    featureApplicationRequired: true,
    featureApplicationSubmitted: false,
    enterpriseAware: false,
    employeeNoticeConfirmed: false,
    customerNoticeConfirmed: false,
    usageScopeConfirmed: false,
    noUnauthorizedMonitoring: false,
    aiAssistOnlyConfirmed: false,
    customerNoticeRequired: true,
    recordingConsentConfirmed: false,
    customerNoticeTemplate: "",
    internalNoticeNotes: ""
  });
  const retentionConfig = parseJsonObject<RetentionConfig>(config?.retentionConfig, {
    dataRetentionDays: 180,
    keepRawText: false,
    keepSummaryOnly: true,
    keepAudioFile: false,
    keepTranscriptOnly: true
  });
  const aiConfig = parseJsonObject<AiConfig>(config?.aiConfig, {
    allowAiSummary: true,
    allowAiTagSuggestion: true,
    allowAiTaskSuggestion: true,
    allowReplySuggestion: true,
    allowAiAnalysis: true,
    allowTranscription: false,
    allowAudioUpload: true,
    allowAutoTranscription: false,
    allowAutoSend: false
  });
  const currentStatus = config?.status ?? CommunicationComplianceStatus.DISABLED;
  const currentProvider = config?.provider ?? CommunicationComplianceProvider.MANUAL;
  const action = upsertCommunicationComplianceConfig.bind(null, tenantSlug, channelDefinition.channel);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ChannelStatusBadge status={currentStatus} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              provider：{currentProvider}
            </span>
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">单独收费功能</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-950">{channelDefinition.title}</h2>
          <p className="text-sm leading-6 text-slate-600">{channelDefinition.summary}</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">必须申请才能开通</p>
          <p className="mt-1 max-w-md leading-6">{channelDefinition.featureHint}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-950">当前说明</p>
          <p className="mt-2 leading-6">{channelDefinition.currentNote}</p>
          <p className="mt-3 leading-6">
            只有当本通道状态为 <span className="font-medium">ENABLED</span> 时，未来 provider 才允许自动写入沟通素材；当前版本仍然不自动采集。
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-950">当前配置摘要</p>
          <div className="mt-2 space-y-2 leading-6">
            <p>状态：{labelOf(statusOptions, currentStatus)}</p>
            <p>收费申请：{noticeConfig.featureApplicationSubmitted ? "已提交" : "未提交"}</p>
            <p>数据保留天数：{retentionConfig.dataRetentionDays ?? 180}</p>
            <p>允许 AI 分析：{aiConfig.allowAiAnalysis ? "是" : "否"}</p>
            <p>允许回复建议：{aiConfig.allowReplySuggestion ? "是" : "否"}</p>
            <p>自动发送客户消息：暂未开放，始终关闭</p>
          </div>
        </div>
      </div>

      {messageText ? (
        <div
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${
            messageType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {messageText}
        </div>
      ) : null}

      <form action={action} className="mt-6 space-y-5">
        <SectionCard
          title="收费申请与启用状态"
          description="该模块是单独收费功能。未提交开通申请前，企业管理员不能把状态改为申请中或已启用。"
        >
          <CheckboxRow
            name="featureApplicationSubmitted"
            label="我确认本企业已提交该收费功能的开通申请"
            defaultChecked={noticeConfig.featureApplicationSubmitted}
            disabled={!canManage}
            description="这是自动采集能力的收费开通前提，不是默认赠送功能。"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="通道状态"
              name="status"
              options={channelDefinition.statusOptions}
              defaultValue={currentStatus}
              disabled={!canManage}
            />
            <Select
              label="provider"
              name="provider"
              options={channelDefinition.providerOptions}
              defaultValue={currentProvider}
              disabled={!canManage}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="合规确认"
          description="未勾选全部确认项前，不能将通道设置为 ENABLED。"
        >
          <div className="grid gap-3">
            <CheckboxRow name="enterpriseAware" label="我确认本企业已了解该功能会涉及工作沟通内容处理。" defaultChecked={noticeConfig.enterpriseAware} disabled={!canManage} />
            <CheckboxRow name="employeeNoticeConfirmed" label="我确认本企业会依法完成员工告知。" defaultChecked={noticeConfig.employeeNoticeConfirmed} disabled={!canManage} />
            <CheckboxRow name="customerNoticeConfirmed" label="我确认本企业会依法向客户进行必要提示。" defaultChecked={noticeConfig.customerNoticeConfirmed} disabled={!canManage} />
            <CheckboxRow name="usageScopeConfirmed" label="我确认仅在工作沟通、客户服务、风险留痕、销售跟进辅助范围内使用。" defaultChecked={noticeConfig.usageScopeConfirmed} disabled={!canManage} />
            <CheckboxRow name="noUnauthorizedMonitoring" label="我确认不会将该功能用于非授权监控或与业务无关的用途。" defaultChecked={noticeConfig.noUnauthorizedMonitoring} disabled={!canManage} />
            <CheckboxRow name="aiAssistOnlyConfirmed" label="我确认 AI 生成内容仅作为辅助建议，最终发送和承诺由人工确认。" defaultChecked={noticeConfig.aiAssistOnlyConfirmed} disabled={!canManage} />
          </div>
        </SectionCard>

        <SectionCard
          title="采集范围"
          description="当前先用轻量配置表达员工、业务线和客户范围。后续接真实 provider 时，必须先检查这里是否为 ENABLED。"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Select label="员工范围" name="employeeScopeMode" options={employeeScopeOptions} defaultValue={scopeConfig.employeeScopeMode} disabled={!canManage} />
            <Select label="业务线范围" name="businessLineScopeMode" options={businessLineScopeOptions} defaultValue={scopeConfig.businessLineScopeMode} disabled={!canManage} />
            <Select label="客户范围" name="customerScopeMode" options={customerScopeOptions} defaultValue={scopeConfig.customerScopeMode} disabled={!canManage} />
          </div>

          <MultiCheckboxGroup
            title="指定员工"
            name="employeeScopeUsers"
            selectedValues={scopeConfig.employeeScopeUsers ?? []}
            disabled={!canManage}
            options={users.map((user) => ({ value: user.id, label: `${user.name} / ${user.role}` }))}
            helperText="当员工范围选择“指定员工”时生效。"
          />

          <MultiCheckboxGroup
            title="指定业务线"
            name="businessLineScopeIds"
            selectedValues={scopeConfig.businessLineScopeIds ?? []}
            disabled={!canManage}
            options={businessLines.map((businessLine) => ({
              value: businessLine.id,
              label: `${businessLine.name} / ${businessLine.status}`
            }))}
            helperText="建议默认只对启用中的业务线开放采集。"
          />

          <CheckboxRow
            name="excludePausedOrArchivedBusinessLines"
            label="不采集暂停或归档业务线"
            defaultChecked={scopeConfig.excludePausedOrArchivedBusinessLines}
            disabled={!canManage}
          />

          <div className="grid gap-4 xl:grid-cols-3">
            <MultiValueTextarea
              label="指定标签客户"
              name="customerScopeTags"
              values={scopeConfig.customerScopeTags ?? []}
              disabled={!canManage}
              helperText="一行一个标签。"
            />
            <MultiValueTextarea
              label="指定业务线客户"
              name="customerScopeBusinessLines"
              values={scopeConfig.customerScopeBusinessLines ?? []}
              disabled={!canManage}
              helperText="一行一个业务线标识。"
            />
            <MultiValueTextarea
              label="指定来源客户"
              name="customerScopeSources"
              values={scopeConfig.customerScopeSources ?? []}
              disabled={!canManage}
              helperText="一行一个来源值，例如 douyin、website。"
            />
          </div>
          <p className="text-xs text-slate-500">文本输入先按一行一个值保存，便于后续在不接真实接口前先把企业范围策略定清楚。</p>
        </SectionCard>

        <SectionCard
          title="员工告知与客户提示"
          description="当前版本不自动发送任何提示，只保留企业内部确认与提示模板留档。"
        >
          <div className="grid gap-3">
            <CheckboxRow name="customerNoticeRequired" label="客户提示是必须项" defaultChecked={noticeConfig.customerNoticeRequired} disabled={!canManage} />
            <CheckboxRow
              name="recordingConsentConfirmed"
              label="我确认电话录音或音频处理场景已完成必要的录音/转写告知"
              defaultChecked={noticeConfig.recordingConsentConfirmed}
              disabled={!canManage}
            />
          </div>
          <Textarea
            label="客户提示模板"
            name="customerNoticeTemplate"
            defaultValue={noticeConfig.customerNoticeTemplate}
            rows={4}
            disabled={!canManage}
          />
          <Textarea
            label="内部告知备注"
            name="internalNoticeNotes"
            defaultValue={noticeConfig.internalNoticeNotes}
            rows={3}
            disabled={!canManage}
          />
        </SectionCard>

        <SectionCard
          title="数据保留设置"
          description="本轮先记录策略，不实际执行自动清理任务。默认建议保留 180 天、保留摘要、不保留原始录音。"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <CheckboxRow name="keepRawText" label="保留原始聊天文本" defaultChecked={retentionConfig.keepRawText} disabled={!canManage} />
            <CheckboxRow name="keepSummaryOnly" label="只保留 AI 摘要" defaultChecked={retentionConfig.keepSummaryOnly} disabled={!canManage} />
            <CheckboxRow name="keepAudioFile" label="保留录音文件" defaultChecked={retentionConfig.keepAudioFile} disabled={!canManage} />
            <CheckboxRow name="keepTranscriptOnly" label="只保留转写文本" defaultChecked={retentionConfig.keepTranscriptOnly} disabled={!canManage} />
          </div>
          <Input label="数据保留天数" name="dataRetentionDays" type="number" defaultValue={String(retentionConfig.dataRetentionDays ?? 180)} disabled={!canManage} />
        </SectionCard>

        <SectionCard
          title="AI 使用边界"
          description="前四类 AI 辅助可配置，但自动发送客户消息当前必须保持关闭。"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <CheckboxRow name="allowAiSummary" label="允许 AI 生成沟通摘要" defaultChecked={aiConfig.allowAiSummary} disabled={!canManage} />
            <CheckboxRow name="allowAiTagSuggestion" label="允许 AI 生成标签建议" defaultChecked={aiConfig.allowAiTagSuggestion} disabled={!canManage} />
            <CheckboxRow name="allowAiTaskSuggestion" label="允许 AI 生成任务建议" defaultChecked={aiConfig.allowAiTaskSuggestion} disabled={!canManage} />
            <CheckboxRow name="allowReplySuggestion" label="允许 AI 生成回复建议" defaultChecked={aiConfig.allowReplySuggestion} disabled={!canManage} />
            <CheckboxRow name="allowAiAnalysis" label="允许 AI 做沟通分析" defaultChecked={aiConfig.allowAiAnalysis} disabled={!canManage} />
            <CheckboxRow name="allowTranscription" label="允许语音转写分析" defaultChecked={aiConfig.allowTranscription} disabled={!canManage} />
            <CheckboxRow name="allowAudioUpload" label="允许上传音频做人工转写整理" defaultChecked={aiConfig.allowAudioUpload} disabled={!canManage} />
            <CheckboxRow name="allowAutoTranscription" label="允许未来自动转写占位开关" defaultChecked={aiConfig.allowAutoTranscription} disabled={!canManage} />
            <CheckboxRow
              name="allowAutoSendDisabledView"
              label="自动发送客户消息"
              defaultChecked={false}
              disabled
              description="暂未开放。为了避免误发和过度承诺，当前版本只生成建议，必须由人工确认。"
            />
          </div>
        </SectionCard>

        {canManage ? (
          <div className="flex justify-end">
            <SubmitButton>保存合规配置</SubmitButton>
          </div>
        ) : (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            当前账号为只读查看模式。只有企业管理员可以启用、暂停或修改合规采集配置。
          </div>
        )}
      </form>
    </Card>
  );
}

export default async function CommunicationCompliancePage({
  params,
  searchParams
}: {
  params: { tenantSlug: string };
  searchParams: SearchParams;
}) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const canManage = canManageCommunicationCompliance(user.role);
  const messageChannel = pickSearchValue(searchParams, "messageChannel");
  const messageType = pickSearchValue(searchParams, "messageType") === "success" ? "success" : pickSearchValue(searchParams, "messageType") === "error" ? "error" : undefined;
  const messageText = pickSearchValue(searchParams, "message");

  const [configs, businessLines, users] = await Promise.all([
    prisma.communicationComplianceConfig.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" }
    }),
    prisma.businessLine.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        status: "active"
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    })
  ]);

  return (
    <PageShell
      tenant={tenant}
      title="沟通素材合规采集配置"
      description="自动采集企业微信聊天、电话录音或语音转文字内容前，必须先完成企业确认、员工告知、客户提示和采集范围设置。未完成合规配置前，系统不会自动读取任何聊天或录音。"
    >
      <div className="space-y-6">
        <Card className="border-rose-200 bg-rose-50">
          <div className="space-y-2 text-sm leading-6 text-rose-800">
            <p className="font-semibold">本系统不会默认自动采集沟通内容。</p>
            <p>本系统不会偷偷读取企业微信聊天。</p>
            <p>本系统不会偷偷读取电话录音。</p>
            <p>本系统不会自动发送客户消息。</p>
            <p>所有自动采集能力都必须由企业管理员主动开启，并完成合规确认。</p>
          </div>
        </Card>

        <Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">收费与开通边界</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                自动采集能力是企业可选项，不是系统默认项，也是单独收费功能。企业不开启时，系统仍只支持手动上传、手动粘贴、人工确认。
              </p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-medium">必须申请才能开通</p>
              <p className="mt-2 leading-6">
                企业微信会话存档、电话录音采集和 ASR 转写都属于未来 provider 能力。当前版本只做配置中心和合规状态，不接真实接口、不自动采集。
              </p>
            </div>
          </div>
        </Card>

        {channelDefinitions.map((channelDefinition) => {
          const config = configs.find((item) => item.channel === channelDefinition.channel);
          return (
            <ComplianceChannelCard
              key={channelDefinition.channel}
              tenantSlug={tenant.slug}
              channelDefinition={channelDefinition}
              config={config}
              canManage={canManage}
              messageType={messageChannel === channelDefinition.channel ? messageType : undefined}
              messageText={messageChannel === channelDefinition.channel ? messageText : ""}
              businessLines={businessLines}
              users={users}
            />
          );
        })}

        <Card>
          <h2 className="text-lg font-semibold text-slate-950">和沟通素材整理模块的关系</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <p>只有当合规配置启用后，未来 provider 才能自动写入沟通素材记录。</p>
            <p>当前版本仍然不自动采集，手动上传、手动粘贴和人工确认不受本配置是否启用限制。</p>
            <p>后续如果接企业微信会话存档或电话录音系统，必须先检查 `CommunicationComplianceConfig` 是否为 `ENABLED`。</p>
            <p>所有自动采集相关动作都应继续写入审计日志，不记录真实聊天内容、不记录录音内容、不记录密钥。</p>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
