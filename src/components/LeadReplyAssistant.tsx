/*
 * 文件说明：该文件实现客户详情页中的智能跟进助手模块。
 * 功能说明：展示客户问题输入、三种风格的建议回复，以及仅供人工确认的智能标签建议。
 *
 * 结构概览：
 *   第一部分：导入依赖与类型
 *   第二部分：智能跟进助手主组件
 *   第三部分：标签建议区
 *   第四部分：建议卡片与辅助展示组件
 */
import type { CustomerType, LeadStage, LeadTag, Material, ReplySuggestion } from "@prisma/client";
import { confirmReplySuggestionTags, generateReplySuggestionsForLead, saveReplySuggestionAsFollowUp } from "@/lib/actions";
import { CopySuggestionButton } from "@/components/CopySuggestionButton";
import { Card, SubmitButton, Textarea } from "@/components/Ui";
import { customerTypeOptions, labelOf, stageOptions } from "@/lib/options";
import {
  detectQuestionType,
  getSuggestedTagKey,
  parseRecommendedMaterialIds,
  parseSuggestedTags,
  questionTypeLabels,
  replySuggestionStyleLabels,
  suggestedTagConfidenceLabels,
  type SuggestedTag
} from "@/lib/reply-suggestions";

type MaterialRecord = Pick<Material, "id" | "title">;
type ExistingTagRecord = Pick<LeadTag, "id" | "tagName">;

export function LeadReplyAssistant({
  tenantSlug,
  leadId,
  leadName,
  customerType,
  stage,
  latestFollowUpContext,
  suggestions,
  materials,
  existingTags
}: {
  tenantSlug: string;
  leadId: string;
  leadName: string;
  customerType: CustomerType;
  stage: LeadStage;
  latestFollowUpContext?: string | null;
  suggestions: ReplySuggestion[];
  materials: MaterialRecord[];
  existingTags: ExistingTagRecord[];
}) {
  const generateAction = generateReplySuggestionsForLead.bind(null, tenantSlug, leadId);
  const saveSuggestionAction = saveReplySuggestionAsFollowUp.bind(null, tenantSlug, leadId);
  const confirmTagsAction = confirmReplySuggestionTags.bind(null, tenantSlug, leadId);
  const latestQuestion = suggestions[0]?.customerQuestion ?? "";
  const latestSuggestion = suggestions[0] ?? null;
  const suggestedTags = latestSuggestion ? parseSuggestedTags(latestSuggestion.suggestedTags) : [];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">V3.1 智能跟进助手</h2>
          <p className="mt-2 text-sm text-slate-600">
            以当前 Lead 为中心读取企业、业务线、客户主体、最近跟进、资料包和任务模板，只生成可复制、可修改的内部建议，不会自动发送到企微，也不会读取其他业务线资料。
          </p>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p>当前客户类型：{labelOf(customerTypeOptions, customerType)}</p>
          <p className="mt-1">当前阶段：{labelOf(stageOptions, stage)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
        <p className="font-medium text-slate-700">最近跟进上下文</p>
        <p className="mt-1">{latestFollowUpContext || "暂无最近跟进记录，生成建议时会先按当前客户类型、阶段、资料包和任务模板判断。"}</p>
      </div>

      <form action={generateAction} className="mt-5 space-y-4">
        <Textarea label="客户刚问了什么" name="customerQuestion" defaultValue={latestQuestion} rows={3} />
        <p className="text-xs text-slate-500">建议尽量输入客户原话，系统会生成 2-3 条建议回复，并推荐当前业务线内的资料和下一步任务。</p>
        <SubmitButton>生成建议回复</SubmitButton>
      </form>

      <TagSuggestionPanel
        confirmTagsAction={confirmTagsAction}
        existingTags={existingTags}
        latestSuggestion={latestSuggestion}
        suggestedTags={suggestedTags}
      />

      <div className="mt-6 space-y-4">
        {suggestions.length ? (
          suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              leadName={leadName}
              materials={materials}
              suggestion={suggestion}
              saveSuggestionAction={saveSuggestionAction}
            />
          ))
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
            还没有生成建议回复。你可以先输入客户问题，再让系统给出三种不同风格的跟进建议。
          </div>
        )}
      </div>
    </Card>
  );
}

function TagSuggestionPanel({
  latestSuggestion,
  suggestedTags,
  existingTags,
  confirmTagsAction
}: {
  latestSuggestion: ReplySuggestion | null;
  suggestedTags: SuggestedTag[];
  existingTags: ExistingTagRecord[];
  confirmTagsAction: (formData: FormData) => Promise<void>;
}) {
  const existingTagNames = new Set(existingTags.map((tag) => tag.tagName));

  return (
    <div className="mt-6 rounded-md border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">智能标签建议</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            系统会根据客户问题和当前客户类型，推荐可能适合的标签。推荐结果仅供参考，不会自动写入客户档案。销售确认后，标签才会添加到客户身上。
          </p>
        </div>
        <div className="rounded-md bg-white px-3 py-2 text-xs text-slate-500">
          <p>客户已有标签：{existingTags.length ? existingTags.length : 0}</p>
          <p className="mt-1">本次推荐标签：{suggestedTags.length ? suggestedTags.length : 0}</p>
        </div>
      </div>

      {suggestedTags.length && latestSuggestion ? (
        <form action={confirmTagsAction} className="mt-4 space-y-4">
          <input name="suggestionId" type="hidden" value={latestSuggestion.id} />
          <div className="space-y-3">
            {suggestedTags.map((tag) => {
              const inputId = `tag-${latestSuggestion.id}-${getSuggestedTagKey(tag)}`;
              const alreadyAdded = existingTagNames.has(tag.tagName);

              return (
                <label
                  key={getSuggestedTagKey(tag)}
                  className={`block rounded-md border px-3 py-3 text-sm ${
                    alreadyAdded ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
                  }`}
                  htmlFor={inputId}
                >
                  <div className="flex items-start gap-3">
                    <input
                      defaultChecked={tag.confidence === "HIGH" && !alreadyAdded}
                      disabled={alreadyAdded}
                      id={inputId}
                      name="selectedTags"
                      type="checkbox"
                      value={getSuggestedTagKey(tag)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{tag.tagName}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{tag.tagGroup}</span>
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                          推荐强度：{suggestedTagConfidenceLabels[tag.confidence]}
                        </span>
                        {alreadyAdded ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">已存在</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-slate-600">推荐理由：{tag.reason}</p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton>确认添加标签</SubmitButton>
            <p className="text-xs text-slate-500">默认勾选高推荐强度标签；已存在标签不会重复添加。</p>
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
          先生成建议回复后，这里才会显示本次推荐标签。
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-600">客户已有标签</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {existingTags.length ? (
            existingTags.map((tag) => (
              <span key={tag.id} className="rounded-md bg-slate-200 px-2.5 py-1 text-xs text-slate-700">
                {tag.tagName}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-500">当前还没有标签。</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  materials,
  saveSuggestionAction,
  leadName
}: {
  suggestion: ReplySuggestion;
  materials: MaterialRecord[];
  saveSuggestionAction: (formData: FormData) => Promise<void>;
  leadName: string;
}) {
  const materialTitles = parseRecommendedMaterialIds(suggestion.recommendedMaterialIds)
    .map((id) => materials.find((material) => material.id === id)?.title)
    .filter((title): title is string => Boolean(title));

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{replySuggestionStyleLabels[suggestion.style]}</h3>
          <p className="mt-1 text-xs text-slate-500">问题分类：{questionTypeLabels[detectQuestionType(suggestion.customerQuestion)]}</p>
        </div>
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">适用于 {leadName}</span>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        回复话术
        <textarea className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800" rows={4} readOnly value={suggestion.suggestionText} />
      </label>

      <div className="mt-4 grid gap-3 text-sm">
        <AssistantLine label="推荐资料" value={materialTitles.length ? materialTitles.join("、") : "-"} />
        <AssistantLine label="下一步动作" value={suggestion.recommendedNextAction} />
        <AssistantLine label="注意事项" value={suggestion.warning} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <CopySuggestionButton text={suggestion.suggestionText} />
        <form action={saveSuggestionAction}>
          <input name="suggestionId" type="hidden" value={suggestion.id} />
          <SubmitButton>保存为跟进记录</SubmitButton>
        </form>
      </div>
    </div>
  );
}

function AssistantLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 text-slate-800">{value}</p>
    </div>
  );
}
