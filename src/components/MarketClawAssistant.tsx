/*
 * 文件说明：该文件实现客户详情页中的 Market Claw 智能回复模块。
 * 功能说明：支持生成回复草稿、展示风险分级与使用模式，并按风险等级提供复制、保存、审核和内部备注入口。
 *
 * 结构概览：
 *   第一部分：导入依赖与类型
 *   第二部分：主组件与草稿卡片
 *   第三部分：回复块、信息块和风险展示辅助组件
 */
import type { BusinessLine, LeadTag, MarketClawKnowledgeItem, MarketClawReplyDraft, Material } from "@prisma/client";
import {
  confirmMarketClawDraftTags,
  createMarketClawFeedback,
  createMarketClawTask,
  generateMarketClawReplyDraft,
  markMarketClawReplyCopied,
  saveMarketClawReplyDraftAsFollowUp,
  saveMarketClawReplyDraftAsPersonalKnowledge,
  submitMarketClawReplyDraftForReview,
  triggerWecomInternalNotification
} from "@/lib/actions";
import { MarketClawCopyButton } from "@/components/MarketClawCopyButton";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";
import {
  marketClawFeedbackOptions,
  marketClawReplyRiskLevelLabels,
  marketClawSendModeLabels,
  marketClawTagGroupLabels,
  parseMarketClawSuggestedTags,
  parseMarketClawSuggestedTask,
  parseMarketClawTextArray
} from "@/lib/market-claw";

type BusinessLineRecord = Pick<BusinessLine, "id" | "name">;
type MaterialRecord = Pick<Material, "id" | "title">;
type KnowledgeRecord = Pick<MarketClawKnowledgeItem, "id" | "title">;
type ExistingTagRecord = Pick<LeadTag, "id" | "tagName" | "tagGroup">;
type DraftRecord = Pick<
  MarketClawReplyDraft,
  | "id"
  | "leadId"
  | "createdById"
  | "customerQuestion"
  | "shortReply"
  | "professionalReply"
  | "closingReply"
  | "riskWarnings"
  | "replyRiskLevel"
  | "sendMode"
  | "riskReason"
  | "requiresReview"
  | "internalOnlyNote"
  | "highRiskKnowledgeIds"
  | "internalAdviceKnowledgeIds"
  | "matchedKnowledgeIds"
  | "suggestedTags"
  | "suggestedMaterials"
  | "suggestedTask"
  | "feedbackStatus"
  | "selectedReplyType"
  | "submittedForReviewAt"
  | "createdAt"
> & {
  trainingCase?: {
    reviewStatus: string;
    reviewComment: string | null;
  } | null;
};

const replyTypeOptions = [
  { value: "SHORT", label: "简短微信版" },
  { value: "PROFESSIONAL", label: "专业说明版" },
  { value: "CLOSING", label: "推进成交版" }
];

function riskTone(level: DraftRecord["replyRiskLevel"]) {
  if (level === "LOW") return "bg-emerald-50 text-emerald-700";
  if (level === "HIGH") return "bg-amber-50 text-amber-800";
  if (level === "BLOCKED") return "bg-rose-50 text-rose-700";
  return "bg-sky-50 text-sky-700";
}

function sendModeTone(mode: DraftRecord["sendMode"]) {
  if (mode === "AUTO_ALLOWED") return "bg-emerald-50 text-emerald-700";
  if (mode === "RISK_CONFIRM_REQUIRED") return "bg-amber-50 text-amber-800";
  if (mode === "INTERNAL_ADVICE_ONLY") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export function MarketClawAssistant({
  tenantSlug,
  leadId,
  businessLines,
  drafts,
  materials,
  knowledgeItems,
  existingTags,
  showGovernance = true,
  unavailable = false
}: {
  tenantSlug: string;
  leadId: string;
  businessLines: BusinessLineRecord[];
  drafts: DraftRecord[];
  materials: MaterialRecord[];
  knowledgeItems: KnowledgeRecord[];
  existingTags: ExistingTagRecord[];
  showGovernance?: boolean;
  unavailable?: boolean;
}) {
  const generateAction = generateMarketClawReplyDraft.bind(null, tenantSlug, leadId);
  const copyAction = markMarketClawReplyCopied.bind(null, tenantSlug, leadId);
  const saveAction = saveMarketClawReplyDraftAsFollowUp.bind(null, tenantSlug, leadId);
  const savePersonalAction = saveMarketClawReplyDraftAsPersonalKnowledge.bind(null, tenantSlug, leadId);
  const submitTrainingAction = submitMarketClawReplyDraftForReview.bind(null, tenantSlug, leadId);
  const confirmTagsAction = confirmMarketClawDraftTags.bind(null, tenantSlug, leadId);
  const createTaskAction = createMarketClawTask.bind(null, tenantSlug, leadId);
  const feedbackAction = createMarketClawFeedback.bind(null, tenantSlug, leadId);
  const notifyAction = triggerWecomInternalNotification.bind(null, tenantSlug);
  const currentBusinessLine = businessLines[0] ?? null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">AI 推荐回复</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            客户提问后，系统会基于当前 Lead 所属业务线生成回复建议、资料推荐和任务建议。销售需要人工确认和修改，本轮仍不做真实自动对外发送，也不会跳转或影响外部官网。
          </p>
        </div>
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>当前版本不接外部沟通入口</p>
          <p className="mt-1">当前版本不自动发送客户消息</p>
        </div>
      </div>

      <form action={generateAction} className="mt-5 space-y-4">
        <Textarea label="客户问题" name="customerQuestion" rows={3} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <input name="businessLineId" type="hidden" value={currentBusinessLine?.id ?? ""} />
            <p className="text-sm font-medium text-slate-700">当前业务线</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {currentBusinessLine?.name ?? "跟随当前 Lead 归属"}
            </p>
            <p className="mt-1 text-xs text-slate-500">V3.1 只按当前 Lead 的企业 / 业务线生成建议，不在这里跨业务线切换。</p>
          </div>
          <Select label="回复风格" name="replyType" options={[{ value: "ALL", label: "全部生成" }, ...replyTypeOptions]} defaultValue="ALL" />
        </div>
        <SubmitButton>生成回复草稿</SubmitButton>
      </form>

      {unavailable ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          当前 AI 推荐暂不可用，可先手工记录跟进。
        </div>
      ) : null}

      <div className="mt-6 space-y-5">
        {drafts.length ? (
          drafts.map((draft) => (
            <MarketClawDraftCard
              key={draft.id}
              confirmTagsAction={confirmTagsAction}
              copyAction={copyAction}
              createTaskAction={createTaskAction}
              draft={draft}
              existingTags={existingTags}
              feedbackAction={feedbackAction}
              knowledgeItems={knowledgeItems}
              materials={materials}
              notifyAction={notifyAction}
              saveAction={saveAction}
              savePersonalAction={savePersonalAction}
              showGovernance={showGovernance}
              submitTrainingAction={submitTrainingAction}
            />
          ))
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
            还没有生成 AI 推荐回复。先输入客户问题，系统会生成回复建议，并标记风险等级和使用方式。
          </div>
        )}
      </div>
    </Card>
  );
}

function MarketClawDraftCard({
  draft,
  materials,
  knowledgeItems,
  existingTags,
  copyAction,
  saveAction,
  savePersonalAction,
  submitTrainingAction,
  confirmTagsAction,
  createTaskAction,
  feedbackAction
  , notifyAction,
  showGovernance
}: {
  draft: DraftRecord;
  materials: MaterialRecord[];
  knowledgeItems: KnowledgeRecord[];
  existingTags: ExistingTagRecord[];
  copyAction: (formData: FormData) => Promise<void>;
  saveAction: (formData: FormData) => Promise<void>;
  savePersonalAction: (formData: FormData) => Promise<void>;
  submitTrainingAction: (formData: FormData) => Promise<void>;
  confirmTagsAction: (formData: FormData) => Promise<void>;
  createTaskAction: (formData: FormData) => Promise<void>;
  feedbackAction: (formData: FormData) => Promise<void>;
  notifyAction: (formData: FormData) => Promise<void>;
  showGovernance: boolean;
}) {
  const matchedKnowledgeTitles = parseMarketClawTextArray(draft.matchedKnowledgeIds)
    .map((id) => knowledgeItems.find((item) => item.id === id)?.title)
    .filter((value): value is string => Boolean(value));
  const highRiskKnowledgeTitles = parseMarketClawTextArray(draft.highRiskKnowledgeIds)
    .map((id) => knowledgeItems.find((item) => item.id === id)?.title)
    .filter((value): value is string => Boolean(value));
  const internalAdviceTitles = parseMarketClawTextArray(draft.internalAdviceKnowledgeIds)
    .map((id) => knowledgeItems.find((item) => item.id === id)?.title)
    .filter((value): value is string => Boolean(value));
  const suggestedMaterialTitles = parseMarketClawTextArray(draft.suggestedMaterials)
    .map((id) => materials.find((item) => item.id === id)?.title)
    .filter((value): value is string => Boolean(value));
  const suggestedTags = parseMarketClawSuggestedTags(draft.suggestedTags);
  const suggestedTask = parseMarketClawSuggestedTask(draft.suggestedTask);
  const riskWarnings = parseMarketClawTextArray(draft.riskWarnings);
  const existingTagKeys = new Set(existingTags.map((item) => `${item.tagGroup}::${item.tagName}`));
  const isBlocked = draft.replyRiskLevel === "BLOCKED";
  const isHighRisk = draft.replyRiskLevel === "HIGH";
  const isMediumRisk = draft.replyRiskLevel === "MEDIUM";

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">客户问题：{draft.customerQuestion}</h3>
          <p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(draft.createdAt))}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-md px-3 py-1 font-medium ${riskTone(draft.replyRiskLevel)}`}>{marketClawReplyRiskLevelLabels[draft.replyRiskLevel]}</span>
          <span className={`rounded-md px-3 py-1 font-medium ${sendModeTone(draft.sendMode)}`}>{marketClawSendModeLabels[draft.sendMode]}</span>
          <span className="rounded-md bg-white px-3 py-1 text-slate-600">反馈状态：{draft.feedbackStatus}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
        <PolicyInfo label="风险等级" value={marketClawReplyRiskLevelLabels[draft.replyRiskLevel]} />
        <PolicyInfo label="使用模式" value={marketClawSendModeLabels[draft.sendMode]} />
        <PolicyInfo label="是否需要边界确认" value={draft.requiresReview ? "是" : "否"} />
        <PolicyInfo label="风险原因" value={draft.riskReason ?? "-"} />
      </div>

      {draft.internalOnlyNote ? (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
          <p className="font-medium text-rose-800">内部建议说明</p>
          <p className="mt-1 leading-6">{draft.internalOnlyNote}</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {isHighRisk ? (
          <>
            <span className="rounded-md bg-amber-50 px-3 py-1 font-medium text-amber-800">查看边界提醒</span>
            <span className="rounded-md bg-amber-50 px-3 py-1 font-medium text-amber-800">确认条件后使用</span>
          </>
        ) : null}
        {isBlocked ? (
          <>
            <span className="rounded-md bg-rose-50 px-3 py-1 font-medium text-rose-700">仅内部建议</span>
            <span className="rounded-md bg-rose-50 px-3 py-1 font-medium text-rose-700">查看不建议承诺事项</span>
          </>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4">
        <ReplyBlock action={copyAction} allowCopy={!isBlocked} draftId={draft.id} replyType="SHORT" title="简短微信版" text={draft.shortReply ?? "-"} />
        <ReplyBlock action={copyAction} allowCopy={!isBlocked} draftId={draft.id} replyType="PROFESSIONAL" title="专业说明版" text={draft.professionalReply ?? "-"} />
        <ReplyBlock action={copyAction} allowCopy={!isBlocked} draftId={draft.id} replyType="CLOSING" title="推进成交版" text={draft.closingReply ?? "-"} />
      </div>

      {showGovernance ? (
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoList title="命中知识依据" values={matchedKnowledgeTitles} emptyText="本次没有命中特定知识条目。" />
        <InfoList title="命中的高风险知识" values={highRiskKnowledgeTitles} emptyText="本次没有命中高风险知识。" />
        <InfoList title="命中的内部建议" values={internalAdviceTitles} emptyText="本次没有命中内部建议知识。" />
        <InfoList title="推荐资料" values={suggestedMaterialTitles} emptyText="本次没有强匹配资料。" />
      </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InfoList title="风险提醒" values={riskWarnings} emptyText="本次没有命中高风险提醒。" />
        <InfoList
          title="下一步任务建议"
          values={suggestedTask ? [`${suggestedTask.title} / ${suggestedTask.priority} / ${suggestedTask.description}`] : []}
          emptyText="本次没有生成任务建议。"
        />
      </div>

      {showGovernance ? (
      <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-950">推荐标签</h4>
        {suggestedTags.length ? (
          <form action={confirmTagsAction} className="mt-3 space-y-3">
            <input name="draftId" type="hidden" value={draft.id} />
            {suggestedTags.map((tag) => {
              const tagKey = `${tag.tagGroup}::${tag.tagName}`;
              const alreadyExists = existingTagKeys.has(tagKey);
              return (
                <label key={tagKey} className={`block rounded-md border px-3 py-3 text-sm ${alreadyExists ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>
                  <div className="flex items-start gap-3">
                    <input defaultChecked={!alreadyExists} disabled={alreadyExists} name="selectedTags" type="checkbox" value={tagKey} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{tag.tagName}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{marketClawTagGroupLabels[tag.tagGroup]}</span>
                        {alreadyExists ? <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">已存在</span> : null}
                      </div>
                      <p className="mt-1 text-slate-600">{tag.reason}</p>
                    </div>
                  </div>
                </label>
              );
            })}
            <SubmitButton>确认添加推荐标签</SubmitButton>
          </form>
        ) : (
          <p className="mt-2 text-sm text-slate-500">本次没有生成推荐标签。</p>
        )}
      </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {!isBlocked ? (
          <form action={saveAction} className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-950">{draft.replyRiskLevel === "LOW" ? "保存为跟进" : "保存为跟进记录"}</h4>
            <input name="draftId" type="hidden" value={draft.id} />
            <Select label="选用回复版本" name="selectedReplyType" options={replyTypeOptions} defaultValue="SHORT" />
            <Textarea label="销售修改版本" name="salesEditedReply" rows={3} />
            <SubmitButton>{draft.replyRiskLevel === "LOW" ? "保存为跟进" : "保存为跟进记录"}</SubmitButton>
          </form>
        ) : (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-rose-800">仅内部建议</h4>
            <p className="text-sm leading-6 text-rose-700">这条内容只能作为内部建议或边界提醒，不应直接作为客户回复使用。</p>
          </div>
        )}

        {showGovernance && !isBlocked ? (
          <form action={savePersonalAction} className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-950">{draft.replyRiskLevel === "LOW" ? "设为低风险承接模板" : "保存为个人常用话术"}</h4>
            <input name="draftId" type="hidden" value={draft.id} />
            <Select label="选用回复版本" name="selectedReplyType" options={replyTypeOptions} defaultValue="PROFESSIONAL" />
            <Input label="个人话术标题" name="knowledgeTitle" defaultValue={`个人话术：${draft.customerQuestion.slice(0, 24)}`} />
            <Textarea label="销售修改版本" name="salesEditedReply" rows={3} />
            <SubmitButton>{draft.replyRiskLevel === "LOW" ? "设为低风险承接模板" : "保存为个人常用话术"}</SubmitButton>
          </form>
        ) : showGovernance ? (
          <form action={feedbackAction} className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-950">保存内部备注</h4>
            <input name="draftId" type="hidden" value={draft.id} />
            <input name="feedbackStatus" type="hidden" value="NEEDS_EDIT" />
            <Textarea label="内部备注" name="feedbackNote" rows={4} />
            <Textarea label="销售备注" name="salesEditedReply" rows={3} />
            <SubmitButton>保存内部备注</SubmitButton>
          </form>
        ) : null}

        {showGovernance ? (
        <form action={submitTrainingAction} className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-950">
            {isBlocked ? "仅内部建议" : isHighRisk ? "确认条件后使用 / 提交优化" : isMediumRisk ? "销售确认后使用 / 提交优化" : "提交为训练样本审核"}
          </h4>
          <input name="draftId" type="hidden" value={draft.id} />
          <Select label="选用回复版本" name="selectedReplyType" options={replyTypeOptions} defaultValue="PROFESSIONAL" />
          <Textarea label="销售修改版本" name="salesEditedReply" rows={3} />
          <Textarea label={isBlocked ? "内部备注" : "销售备注"} name="salesNote" rows={3} />
          <SubmitButton>{isBlocked ? "保存内部建议" : isHighRisk ? "确认条件后使用 / 提交优化" : isMediumRisk ? "销售确认后使用 / 提交优化" : "提交为训练样本审核"}</SubmitButton>
        </form>
        ) : null}

        {showGovernance ? (
        <form action={feedbackAction} className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-950">使用反馈</h4>
          <input name="draftId" type="hidden" value={draft.id} />
          <Select label="反馈结论" name="feedbackStatus" options={marketClawFeedbackOptions.map((item) => ({ value: item.value, label: item.label }))} defaultValue="USEFUL" />
          <Textarea label="反馈说明" name="feedbackNote" rows={3} />
          <Textarea label="销售修改版本" name="salesEditedReply" rows={3} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input name="recommendAsTrainingCase" type="checkbox" />
            <span>建议沉淀为训练样本</span>
          </label>
          <SubmitButton>提交反馈</SubmitButton>
        </form>
        ) : null}
      </div>

      {showGovernance ? (
      <div className="mt-4 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">训练状态</p>
        <p className="mt-2">{draft.submittedForReviewAt ? "这条回复已经提交审核。" : "这条回复还没有提交审核。"}</p>
        {draft.trainingCase ? <p className="mt-1">当前训练状态：{draft.trainingCase.reviewStatus}</p> : null}
        {draft.trainingCase?.reviewComment ? <p className="mt-1">审核意见：{draft.trainingCase.reviewComment}</p> : null}
      </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        {suggestedTask ? (
          <form action={createTaskAction}>
            <input name="draftId" type="hidden" value={draft.id} />
            <SubmitButton>{isBlocked || isHighRisk ? "创建负责人任务" : "创建下一步任务"}</SubmitButton>
          </form>
        ) : null}
        {isHighRisk ? (
          <form action={notifyAction}>
            <input name="eventType" type="hidden" value="HIGH_RISK_REPLY" />
            <input name="recipientUserId" type="hidden" value={draft.createdById} />
            <input name="relatedLeadId" type="hidden" value={draft.leadId} />
            <input name="relatedReplyDraftId" type="hidden" value={draft.id} />
            <input name="title" type="hidden" value="风险边界确认提醒" />
            <input name="content" type="hidden" value="AI 推荐回复命中高风险提醒，请回到系统查看边界提醒并确认条件后再使用。" />
            <SubmitButton>发送风险边界确认提醒</SubmitButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function ReplyBlock({
  title,
  text,
  draftId,
  replyType,
  action,
  allowCopy
}: {
  title: string;
  text: string;
  draftId: string;
  replyType: string;
  action: (formData: FormData) => Promise<void>;
  allowCopy: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
        {allowCopy ? <MarketClawCopyButton action={action} draftId={draftId} selectedReplyType={replyType} text={text} /> : null}
      </div>
      <textarea className="mt-3 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800" rows={4} readOnly value={text} />
    </div>
  );
}

function InfoList({ title, values, emptyText }: { title: string; values: string[]; emptyText: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
      <div className="mt-2 space-y-2 text-sm text-slate-700">
        {values.length ? values.map((value) => <p key={value}>{value}</p>) : <p className="text-slate-500">{emptyText}</p>}
      </div>
    </div>
  );
}

function PolicyInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}
