/*
 * 文件说明：该文件实现客户详情页中的麻虾智能回复模块。
 * 功能说明：支持生成三版回复草稿、查看命中知识与风险提醒，并完成标签确认、保存跟进、创建任务和反馈沉淀。
 *
 * 结构概览：
 *   第一部分：导入依赖与类型
 *   第二部分：麻虾主组件
 *   第三部分：草稿卡片与辅助展示
 */
import type { BusinessLine, LeadTag, MarketClawKnowledgeItem, MarketClawReplyDraft, Material } from "@prisma/client";
import {
  confirmMarketClawDraftTags,
  createMarketClawFeedback,
  createMarketClawTask,
  generateMarketClawReplyDraft,
  markMarketClawReplyCopied,
  saveMarketClawReplyDraftAsFollowUp
} from "@/lib/actions";
import { MarketClawCopyButton } from "@/components/MarketClawCopyButton";
import { Card, Select, SubmitButton, Textarea } from "@/components/Ui";
import {
  marketClawFeedbackOptions,
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
  | "customerQuestion"
  | "shortReply"
  | "professionalReply"
  | "closingReply"
  | "riskWarnings"
  | "matchedKnowledgeIds"
  | "suggestedTags"
  | "suggestedMaterials"
  | "suggestedTask"
  | "feedbackStatus"
  | "createdAt"
>;

const replyTypeOptions = [
  { value: "SHORT", label: "简短微信版" },
  { value: "PROFESSIONAL", label: "专业说明版" },
  { value: "CLOSING", label: "推进成交版" }
];

export function MarketClawAssistant({
  tenantSlug,
  leadId,
  businessLines,
  drafts,
  materials,
  knowledgeItems,
  existingTags
}: {
  tenantSlug: string;
  leadId: string;
  businessLines: BusinessLineRecord[];
  drafts: DraftRecord[];
  materials: MaterialRecord[];
  knowledgeItems: KnowledgeRecord[];
  existingTags: ExistingTagRecord[];
}) {
  const generateAction = generateMarketClawReplyDraft.bind(null, tenantSlug, leadId);
  const copyAction = markMarketClawReplyCopied.bind(null, tenantSlug, leadId);
  const saveAction = saveMarketClawReplyDraftAsFollowUp.bind(null, tenantSlug, leadId);
  const confirmTagsAction = confirmMarketClawDraftTags.bind(null, tenantSlug, leadId);
  const createTaskAction = createMarketClawTask.bind(null, tenantSlug, leadId);
  const feedbackAction = createMarketClawFeedback.bind(null, tenantSlug, leadId);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">麻虾智能回复</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            客户问问题时，麻虾会根据企业知识库、业务线、客户阶段和已有标签生成回复草稿。回复不会自动发送，只支持复制、保存为跟进和记录反馈。
          </p>
        </div>
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>当前版本不接企业微信上下文</p>
          <p className="mt-1">当前版本不自动发送客户消息</p>
        </div>
      </div>

      <form action={generateAction} className="mt-5 space-y-4">
        <Textarea label="客户问题" name="customerQuestion" rows={3} />
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="业务线"
            name="businessLineId"
            options={[
              { value: "", label: "自动判断或使用默认业务线" },
              ...businessLines.map((item) => ({ value: item.id, label: item.name }))
            ]}
          />
          <Select label="回复风格" name="replyType" options={[{ value: "ALL", label: "全部生成" }, ...replyTypeOptions]} defaultValue="ALL" />
        </div>
        <SubmitButton>生成回复草稿</SubmitButton>
      </form>

      <div className="mt-6 space-y-5">
        {drafts.length ? (
          drafts.map((draft) => (
            <MarketClawDraftCard
              key={draft.id}
              copyAction={copyAction}
              createTaskAction={createTaskAction}
              draft={draft}
              existingTags={existingTags}
              feedbackAction={feedbackAction}
              confirmTagsAction={confirmTagsAction}
              knowledgeItems={knowledgeItems}
              materials={materials}
              saveAction={saveAction}
            />
          ))
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
            还没有生成麻虾回复草稿。先输入客户问题，系统会生成简短微信版、专业说明版和推进成交版三种回复。
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
  confirmTagsAction,
  createTaskAction,
  feedbackAction
}: {
  draft: DraftRecord;
  materials: MaterialRecord[];
  knowledgeItems: KnowledgeRecord[];
  existingTags: ExistingTagRecord[];
  copyAction: (formData: FormData) => Promise<void>;
  saveAction: (formData: FormData) => Promise<void>;
  confirmTagsAction: (formData: FormData) => Promise<void>;
  createTaskAction: (formData: FormData) => Promise<void>;
  feedbackAction: (formData: FormData) => Promise<void>;
}) {
  const matchedKnowledgeTitles = parseMarketClawTextArray(draft.matchedKnowledgeIds)
    .map((id) => knowledgeItems.find((item) => item.id === id)?.title)
    .filter((value): value is string => Boolean(value));
  const suggestedMaterialTitles = parseMarketClawTextArray(draft.suggestedMaterials)
    .map((id) => materials.find((item) => item.id === id)?.title)
    .filter((value): value is string => Boolean(value));
  const suggestedTags = parseMarketClawSuggestedTags(draft.suggestedTags);
  const suggestedTask = parseMarketClawSuggestedTask(draft.suggestedTask);
  const riskWarnings = parseMarketClawTextArray(draft.riskWarnings);
  const existingTagKeys = new Set(existingTags.map((item) => `${item.tagGroup}::${item.tagName}`));

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">客户问题：{draft.customerQuestion}</h3>
          <p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(draft.createdAt))}</p>
        </div>
        <span className="rounded-md bg-white px-3 py-1 text-xs text-slate-600">反馈状态：{draft.feedbackStatus}</span>
      </div>

      <div className="mt-4 grid gap-4">
        <ReplyBlock action={copyAction} draftId={draft.id} replyType="SHORT" title="简短微信版" text={draft.shortReply ?? "-"} />
        <ReplyBlock action={copyAction} draftId={draft.id} replyType="PROFESSIONAL" title="专业说明版" text={draft.professionalReply ?? "-"} />
        <ReplyBlock action={copyAction} draftId={draft.id} replyType="CLOSING" title="推进成交版" text={draft.closingReply ?? "-"} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InfoList title="命中知识依据" values={matchedKnowledgeTitles} emptyText="本次未命中特定知识条目。" />
        <InfoList title="推荐资料" values={suggestedMaterialTitles} emptyText="本次没有强匹配资料。" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InfoList title="风险提醒" values={riskWarnings} emptyText="本次没有命中高风险提醒。" />
        <InfoList
          title="下一步任务建议"
          values={suggestedTask ? [`${suggestedTask.title} / ${suggestedTask.priority} / ${suggestedTask.description}`] : []}
          emptyText="本次没有生成任务建议。"
        />
      </div>

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

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <form action={saveAction} className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-950">保存为跟进记录</h4>
          <input name="draftId" type="hidden" value={draft.id} />
          <Select label="选用回复版本" name="selectedReplyType" options={replyTypeOptions} defaultValue="SHORT" />
          <Textarea label="销售修改版本" name="salesEditedReply" rows={3} />
          <SubmitButton>保存为跟进记录</SubmitButton>
        </form>

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
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {suggestedTask ? (
          <form action={createTaskAction}>
            <input name="draftId" type="hidden" value={draft.id} />
            <SubmitButton>创建下一步任务</SubmitButton>
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
  action
}: {
  title: string;
  text: string;
  draftId: string;
  replyType: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
        <MarketClawCopyButton action={action} draftId={draftId} selectedReplyType={replyType} text={text} />
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
