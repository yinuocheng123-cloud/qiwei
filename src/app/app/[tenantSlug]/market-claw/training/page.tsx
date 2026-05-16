/*
 * 文件说明：该文件实现 V2.0 麻虾回复训练场页面。
 * 功能说明：允许企业管理员与运营模拟客户问题、生成三版回复，并把人工优化后的版本沉淀为标准回复知识。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：训练场页面
 *   第三部分：辅助展示组件
 */
import { generateMarketClawTrainingCase, reviewMarketClawTrainingCase, saveMarketClawTrainingAsKnowledge } from "@/lib/actions";
import { canAccessMarketClawTraining, requireTenantAccess } from "@/lib/auth";
import { customerTypeOptions, stageOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

const ratingOptions = [
  { value: "GOOD", label: "可用" },
  { value: "NEEDS_EDIT", label: "需修改" },
  { value: "BAD", label: "不可用" },
  { value: "UNRATED", label: "暂不评价" }
];

const reviewStatusOptions = [
  { value: "REVIEWED", label: "已复核" },
  { value: "DISMISSED", label: "弃用" }
];

export default async function MarketClawTrainingPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canAccessMarketClawTraining(user.role)) {
    return null;
  }

  const [businessLines, trainingCases] = await Promise.all([
    prisma.businessLine.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.marketClawTrainingCase.findMany({
      where: { tenantId: tenant.id },
      include: { businessLine: true, createdBy: true, savedAsKnowledgeItem: true },
      orderBy: { updatedAt: "desc" },
      take: 10
    })
  ]);

  const generateAction = generateMarketClawTrainingCase.bind(null, tenant.slug);

  return (
    <PageShell
      tenant={tenant}
      title="Market Claw 回复训练场"
      description="在这里模拟客户问题，测试 Market Claw 生成的回复是否准确、像人话、有边界。可用回复可以沉淀为标准话术，不可用回复要记录问题，持续训练。"
    >
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-slate-950">测试条件</h2>
          <form action={generateAction} className="space-y-4">
            <Textarea label="客户问题" name="customerQuestion" rows={4} />
            <Select
              label="业务线"
              name="businessLineId"
              options={businessLines.map((item) => ({ value: item.id, label: item.name }))}
              defaultValue={businessLines[0]?.id}
            />
            <Select label="客户类型" name="customerType" options={customerTypeOptions} defaultValue="PLATFORM_GEO_AI_CLIENT" />
            <Select label="客户阶段" name="customerStage" options={stageOptions} defaultValue="NEW" />
            <Textarea label="客户标签" name="customerTags" rows={2} />
            <Input label="回复风格备注" name="replyStyle" defaultValue="像销售，不像客服" />
            <Input label="回复长度备注" name="replyLength" defaultValue="微信可直接发" />
            <SubmitButton>生成训练结果</SubmitButton>
          </form>
        </Card>

        <div className="space-y-4">
          {trainingCases.length ? (
            trainingCases.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-emerald-700">{item.businessLine.name}</p>
                    <h2 className="text-lg font-semibold text-slate-950">{item.customerQuestion}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      生成人：{item.createdBy.name} / 当前状态：{item.reviewStatus}
                    </p>
                  </div>
                  {item.savedAsKnowledgeItem ? <span className="rounded-md bg-emerald-50 px-3 py-1 text-xs text-emerald-700">已沉淀为标准回复</span> : null}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <ReplyView title="简短微信版" value={item.generatedShortReply} />
                  <ReplyView title="专业说明版" value={item.generatedProfessionalReply} />
                  <ReplyView title="推进成交版" value={item.generatedClosingReply} />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <ReplyView title="风险提醒" value={item.forbiddenNotes} rows={4} />
                  <ReplyView title="人工优化版本" value={item.manualOptimizedReply} rows={4} />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <form action={reviewMarketClawTrainingCase.bind(null, tenant.slug, item.id)} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-950">评估与训练</h3>
                    <Select label="训练结论" name="rating" options={ratingOptions} defaultValue={item.rating} />
                    <Select label="状态" name="reviewStatus" options={reviewStatusOptions} defaultValue="REVIEWED" />
                    <Textarea label="人工优化版本" name="manualOptimizedReply" defaultValue={item.manualOptimizedReply ?? ""} rows={4} />
                    <Textarea label="禁止表达或风险提醒" name="forbiddenNotes" defaultValue={item.forbiddenNotes ?? ""} rows={3} />
                    <SubmitButton>保存训练结论</SubmitButton>
                  </form>

                  <form action={saveMarketClawTrainingAsKnowledge.bind(null, tenant.slug, item.id)} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-950">沉淀为标准回复</h3>
                    <Input label="知识标题" name="knowledgeTitle" defaultValue={`标准回复：${item.customerQuestion.slice(0, 24)}`} />
                    <Textarea label="人工优化版本" name="manualOptimizedReply" defaultValue={item.manualOptimizedReply ?? item.generatedProfessionalReply ?? ""} rows={4} />
                    <Textarea label="禁止表达列表" name="forbiddenPhraseList" rows={3} />
                    <Textarea label="风险提醒" name="forbiddenNotes" defaultValue={item.forbiddenNotes ?? ""} rows={3} />
                    <Select label="训练评分" name="rating" options={ratingOptions} defaultValue={item.rating} />
                    <SubmitButton>沉淀为标准回复</SubmitButton>
                  </form>
                </div>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm text-slate-500">当前还没有训练记录。先用一个真实客户问题跑一轮，看看 Market Claw 给出的边界是否够稳。</p>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function ReplyView({ title, value, rows = 6 }: { title: string; value?: string | null; rows?: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <textarea className="mt-3 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800" rows={rows} readOnly value={value ?? "-"} />
    </div>
  );
}
