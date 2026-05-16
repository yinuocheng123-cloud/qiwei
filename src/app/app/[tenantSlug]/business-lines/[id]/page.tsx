/*
 * 文件说明：该页面实现 V2.0.3 的产品详情页。
 * 功能说明：承接产品总览页的“查看详情”入口，用 Tab 方式展示基础信息、关联资产、Market Claw 知识和操作记录。
 *
 * 结构概览：
 *   第一部分：Tab 配置与展示组件
 *   第二部分：详情页数据查询
 *   第三部分：按 Tab 渲染产品详情
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateBusinessLine, updateBusinessLineStatus } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import {
  countBusinessLineMaterials,
  countBusinessLineTags,
  countBusinessLineTaskTemplates,
  parseBusinessLineCustomerTypes,
  parseBusinessLineIdList,
  parseBusinessLineRecommendedTags
} from "@/lib/business-lines";
import { businessLineCategoryOptions, businessLineStatusOptions, customerTypeOptions, formatDate, labelOf } from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { BusinessLineForm, StatusActionButtons } from "@/components/BusinessLineEditor";
import { PageShell } from "@/components/Shell";
import { Callout, Card, SectionTabs, StatCard } from "@/components/Ui";

export const dynamic = "force-dynamic";

const tabs = [
  { key: "overview", label: "基础信息" },
  { key: "customers", label: "适合客户" },
  { key: "tags", label: "推荐标签" },
  { key: "materials", label: "关联资料" },
  { key: "tasks", label: "任务模板" },
  { key: "knowledge", label: "Market Claw 知识" },
  { key: "sop", label: "跟进 SOP" },
  { key: "risk", label: "风险边界" },
  { key: "audit", label: "操作记录" }
] as const;

type TabKey = (typeof tabs)[number]["key"];

function isTabKey(value?: string): value is TabKey {
  return tabs.some((tab) => tab.key === value);
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{text}</p>
    </Card>
  );
}

export default async function BusinessLineDetailPage({
  params,
  searchParams
}: {
  params: { tenantSlug: string; id: string };
  searchParams?: { tab?: string };
}) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const canEdit = user.role === "TENANT_ADMIN" || user.role === "OPERATOR";
  const canArchive = user.role === "TENANT_ADMIN";
  const activeTab: TabKey = isTabKey(searchParams?.tab) ? searchParams.tab : "overview";

  const businessLine = await prisma.businessLine.findFirst({
    where: {
      id: params.id,
      tenantId: tenant.id,
      ...(canEdit ? {} : { status: "ACTIVE" })
    }
  });

  if (!businessLine) {
    notFound();
  }

  const [materials, taskTemplates, knowledgeItems, trainingCases, recentDrafts, replyDraftCount, feedbackCount, followUpCount, auditLogs] =
    await Promise.all([
      prisma.material.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ customerType: "asc" }, { createdAt: "desc" }]
      }),
      prisma.taskTemplate.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }]
      }),
      prisma.marketClawKnowledgeItem.findMany({
        where: { tenantId: tenant.id, businessLineId: businessLine.id },
        select: { id: true, title: true, knowledgeType: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 6
      }),
      prisma.marketClawTrainingCase.findMany({
        where: { tenantId: tenant.id, businessLineId: businessLine.id },
        select: { id: true, customerQuestion: true, rating: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 6
      }),
      prisma.marketClawReplyDraft.findMany({
        where: { tenantId: tenant.id, businessLineId: businessLine.id },
        select: {
          id: true,
          customerQuestion: true,
          feedbackStatus: true,
          createdAt: true,
          lead: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 6
      }),
      prisma.marketClawReplyDraft.count({
        where: { tenantId: tenant.id, businessLineId: businessLine.id }
      }),
      prisma.marketClawReplyFeedback.count({
        where: { tenantId: tenant.id, replyDraft: { businessLineId: businessLine.id } }
      }),
      prisma.followUp.count({
        where: { tenantId: tenant.id, marketClawReplyDraft: { is: { businessLineId: businessLine.id } } }
      }),
      prisma.auditLog.findMany({
        where: {
          tenantId: tenant.id,
          entityType: "BusinessLine",
          entityId: businessLine.id
        },
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    ]);

  const updateAction = updateBusinessLine.bind(null, tenant.slug, businessLine.id);
  const selectedCustomerTypes = parseBusinessLineCustomerTypes(businessLine.targetCustomerTypes);
  const recommendedTags = parseBusinessLineRecommendedTags(businessLine.recommendedTagNames);
  const recommendedMaterialIds = new Set(parseBusinessLineIdList(businessLine.recommendedMaterialIds));
  const recommendedTaskTemplateIds = new Set(parseBusinessLineIdList(businessLine.recommendedTaskTemplateIds));
  const recommendedMaterials = materials.filter((item) => recommendedMaterialIds.has(item.id));
  const recommendedTaskTemplates = taskTemplates.filter((item) => recommendedTaskTemplateIds.has(item.id));

  const tabHref = (tab: TabKey) => `/app/${tenant.slug}/business-lines/${businessLine.id}?tab=${tab}`;

  return (
    <PageShell
      tenant={tenant}
      title={`产品详情：${businessLine.name}`}
      breadcrumbs={[
        { label: "业务配置", href: `/app/${tenant.slug}/business-lines` },
        { label: "产品总览", href: `/app/${tenant.slug}/business-lines#product-overview` },
        { label: businessLine.name }
      ]}
      description="从产品总览进入后，再在详情页里维护适合客户、推荐标签、关联资料、任务模板和 Market Claw 相关信息。"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="当前状态" value={labelOf(businessLineStatusOptions, businessLine.status)} />
        <StatCard label="推荐标签" value={`${countBusinessLineTags(businessLine)} 个`} />
        <StatCard label="关联资料" value={`${countBusinessLineMaterials(businessLine)} 份`} />
        <StatCard label="任务模板" value={`${countBusinessLineTaskTemplates(businessLine)} 个`} />
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-emerald-700">{labelOf(businessLineCategoryOptions, businessLine.category)}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{businessLine.name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {businessLine.description || "当前还没有补充产品说明，可在基础信息里继续完善。"}
            </p>
          </div>
          {canEdit ? (
            <StatusActionButtons
              tenantSlug={tenant.slug}
              businessLine={businessLine}
              canArchive={canArchive}
              action={updateBusinessLineStatus}
            />
          ) : null}
        </div>

        <SectionTabs items={tabs.map((tab) => ({ key: tab.key, label: tab.label, href: tabHref(tab.key) }))} current={activeTab} className="mt-5" />
      </Card>

      {activeTab === "overview" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <SectionTitle title="基础信息" description="在详情页里继续维护字段，不再把长表单摊在产品总览页。" />
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <InfoLine label="分类" value={labelOf(businessLineCategoryOptions, businessLine.category)} />
              <InfoLine label="状态" value={labelOf(businessLineStatusOptions, businessLine.status)} />
              <InfoLine label="优先级" value={String(businessLine.priority)} />
              <InfoLine label="最近更新时间" value={formatDate(businessLine.updatedAt)} />
              <InfoLine label="默认下一步动作" value={businessLine.defaultNextAction || "-"} />
              <InfoLine label="适合客户类型数" value={selectedCustomerTypes.length ? `${selectedCustomerTypes.length} 类` : "未限制"} />
            </div>
            <Callout className="mt-4" title="风险边界提醒" tone="amber">
              不做物理删除，不因为产品暂停或归档打断历史客户、标签、任务和 Market Claw 回复记录。涉及价格、效果、周期和名额承诺时，优先回看风险边界与知识条目。
            </Callout>
            {canEdit ? (
              <div className="mt-6">
                <BusinessLineForm
                  action={updateAction}
                  submitText="保存产品详情"
                  materials={materials}
                  taskTemplates={taskTemplates}
                  businessLine={businessLine}
                  canArchive={canArchive}
                />
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionTitle title="详情摘要" description="先看核心状态，再决定继续维护客户适配、标签、资料、任务模板还是 Market Claw 知识。" />
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <p>当前状态：{labelOf(businessLineStatusOptions, businessLine.status)}</p>
              <p>适合客户：{selectedCustomerTypes.length ? selectedCustomerTypes.map((item) => labelOf(customerTypeOptions, item)).join("、") : "未限制"}</p>
              <p>推荐标签：{countBusinessLineTags(businessLine)} 个</p>
              <p>关联资料：{countBusinessLineMaterials(businessLine)} 份</p>
              <p>关联任务模板：{countBusinessLineTaskTemplates(businessLine)} 个</p>
              <p>Market Claw 知识：{knowledgeItems.length} 条最近记录</p>
              <p>Market Claw 训练样本：{trainingCases.length} 条最近记录</p>
              <p>最近回复草稿：{replyDraftCount} 条</p>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "customers" ? (
        <div className="mt-6">
          <Card>
            <SectionTitle title="适合客户" description="这里说明产品优先面对哪些客户类型，帮助销售快速判断入口是否匹配。" />
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedCustomerTypes.length ? (
                selectedCustomerTypes.map((item) => (
                  <span key={item} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                    {labelOf(customerTypeOptions, item)}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">当前未限制客户类型，默认按通用产品处理。</p>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "tags" ? (
        <div className="mt-6">
          <Card>
            <SectionTitle title="推荐标签" description="推荐标签继续沿用现有标签体系，只在这里沉淀产品维度的推荐口径。" />
            <div className="mt-4 space-y-3">
              {recommendedTags.length ? (
                recommendedTags.map((tag) => (
                  <div key={`${tag.tagGroup}-${tag.tagName}`} className="rounded-md border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">{tag.tagName}</p>
                    <p className="mt-1 text-slate-500">{tag.tagGroup}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">当前还没有配置推荐标签。</p>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "materials" ? (
        <div className="mt-6">
          <Card>
            <SectionTitle title="关联资料" description="资料仍由资料包页面维护，这里只沉淀当前产品优先推荐哪些资料。" />
            <div className="mt-4 space-y-3">
              {recommendedMaterials.length ? (
                recommendedMaterials.map((material) => (
                  <div key={material.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{material.title}</p>
                      <Link className="text-emerald-700" href={`/app/${tenant.slug}/materials`}>
                        去资料包查看
                      </Link>
                    </div>
                    <p className="mt-1 text-slate-500">{material.customerType ? labelOf(customerTypeOptions, material.customerType) : "通用资料"}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">当前还没有绑定推荐资料。</p>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "tasks" ? (
        <div className="mt-6">
          <Card>
            <SectionTitle title="任务模板" description="任务模板继续在任务模板页维护，这里只显示当前产品优先联动的模板。" />
            <div className="mt-4 space-y-3">
              {recommendedTaskTemplates.length ? (
                recommendedTaskTemplates.map((template) => (
                  <div key={template.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{template.name}</p>
                      <Link className="text-emerald-700" href={`/app/${tenant.slug}/task-templates`}>
                        去任务模板查看
                      </Link>
                    </div>
                    <p className="mt-1 text-slate-500">{template.title}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">当前还没有绑定任务模板。</p>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "knowledge" ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="知识条目" value={knowledgeItems.length} />
            <StatCard label="训练样本" value={trainingCases.length} />
            <StatCard label="回复草稿" value={replyDraftCount} />
            <StatCard label="使用反馈" value={feedbackCount} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <SectionTitle title="最近知识条目" />
              <div className="mt-4 space-y-3">
                {knowledgeItems.length ? (
                  knowledgeItems.map((item) => (
                    <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="mt-1 text-slate-500">{item.knowledgeType}</p>
                      <p className="mt-1 text-slate-500">{formatDate(item.updatedAt)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">当前还没有关联的 Market Claw 知识条目。</p>
                )}
              </div>
            </Card>

            <Card>
              <SectionTitle title="最近训练与使用" />
              <div className="mt-4 space-y-3">
                {trainingCases.length ? (
                  trainingCases.map((item) => (
                    <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-900">{item.customerQuestion}</p>
                      <p className="mt-1 text-slate-500">训练评分：{item.rating}</p>
                      <p className="mt-1 text-slate-500">{formatDate(item.updatedAt)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">当前还没有训练样本。</p>
                )}
                {recentDrafts.length ? (
                  <div className="rounded-md border border-dashed border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">最近回复草稿</p>
                    <div className="mt-2 space-y-2">
                      {recentDrafts.map((draft) => (
                        <p key={draft.id} className="text-slate-600">
                          {draft.lead.name}：{draft.customerQuestion}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "sop" ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <SectionTitle title="跟进 SOP" description="先沉淀默认下一步动作，再配合任务模板和资料建议承接销售动作。" />
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <p>默认下一步动作：{businessLine.defaultNextAction || "暂未设置"}</p>
              <p>跟进记录承接数：{followUpCount}</p>
              <p>推荐任务模板数：{recommendedTaskTemplates.length}</p>
            </div>
          </Card>

          <Card>
            <SectionTitle title="维护备注" description="这里保留内部口径、实施提醒和交接说明，不强行挤到总览页。" />
            <p className="mt-4 text-sm leading-6 text-slate-700">{businessLine.notes || "当前还没有内部备注。"}</p>
          </Card>
        </div>
      ) : null}

      {activeTab === "risk" ? (
        <div className="mt-6">
          <Card>
            <SectionTitle title="风险边界" description="继续坚持不做物理删除，历史客户、标签、任务和回复记录不因产品归档而断裂。" />
            <Callout title="不能承诺事项" tone="amber">
              销售不能直接承诺价格锁定、效果保证、评审结果、交付时长和资源名额。涉及这些内容时，要回到知识库、训练场或人工确认后再回复客户。
            </Callout>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>1. 销售只查看启用产品，不承担产品维护职责。</p>
              <p>2. 运营可以启用和暂停产品，但不能归档。</p>
              <p>3. 企业管理员可以归档，但仍不做物理删除。</p>
              <p>4. 产品归档后，历史客户、标签、任务模板联动和 Market Claw 记录继续保留。</p>
              <p>5. 内部备注：{businessLine.notes || "当前暂无额外风险备注。"}</p>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "audit" ? (
        <div className="mt-6">
          <Card>
            <SectionTitle title="操作记录" description="继续沿用现有 AuditLog，不扩权限，只把产品相关动作集中展示。" />
            <div className="mt-4 space-y-3">
              {auditLogs.length ? (
                auditLogs.map((log) => (
                  <div key={log.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">{log.action}</p>
                    <p className="mt-1 text-slate-500">操作人：{log.user?.name ?? "系统或未知用户"}</p>
                    <p className="mt-1 text-slate-500">{formatDate(log.createdAt)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">当前还没有产品操作记录。</p>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}
