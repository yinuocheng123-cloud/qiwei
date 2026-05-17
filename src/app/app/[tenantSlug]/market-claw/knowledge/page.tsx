/*
 * 文件说明：该文件实现 V2.0 麻虾知识库投喂中心页面。
 * 功能说明：允许企业管理员与运营维护业务线知识、FAQ、价格边界和不能承诺事项，供麻虾生成回复草稿时引用。
 *
 * 结构概览：
 *   第一部分：导入依赖与表单辅助组件
 *   第二部分：知识表单组件
 *   第三部分：知识库页面
 */
import { createMarketClawKnowledgeItem, updateMarketClawKnowledgeItem } from "@/lib/actions";
import { canAccessMarketClawKnowledge, requireTenantAccess } from "@/lib/auth";
import {
  marketClawKnowledgeReviewStatusOptions,
  marketClawKnowledgeScopeOptions,
  marketClawKnowledgeStatusOptions,
  marketClawKnowledgeTypeOptions,
  marketClawKnowledgeVisibilityOptions
} from "@/lib/market-claw";
import { customerTypeOptions, stageOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Card, Input, SectionTabs, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

function CheckboxGrid({
  label,
  name,
  options,
  selectedValues
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input defaultChecked={selectedValues.includes(option.value)} name={name} type="checkbox" value={option.value} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function MaterialCheckboxes({
  materials,
  selectedIds
}: {
  materials: { id: string; title: string }[];
  selectedIds: string[];
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">关联资料包</p>
      {materials.length ? (
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
          {materials.map((material) => (
            <label key={material.id} className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-700">
              <input defaultChecked={selectedIds.includes(material.id)} name="recommendedMaterialIds" type="checkbox" value={material.id} />
              <span>{material.title}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">当前租户还没有资料包。</p>
      )}
    </div>
  );
}

function parseStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function KnowledgeForm({
  action,
  businessLines,
  materials,
  item
}: {
  action: (formData: FormData) => Promise<void>;
  businessLines: { id: string; name: string }[];
  materials: { id: string; title: string }[];
  item?: {
    businessLineId: string | null;
    ownerUserId?: string | null;
    departmentName?: string | null;
    knowledgeType: string;
    status: string;
    scopeLevel?: string;
    visibility?: string;
    reviewStatus?: string;
    title: string;
    content: string;
    keywords: unknown;
    applicableCustomerTypes: unknown;
    applicableStages: unknown;
    recommendedMaterialIds: unknown;
    forbiddenPhrases: unknown;
    riskNotes: string | null;
    sortOrder: number;
  };
}) {
  const selectedCustomerTypes = parseStringArray(item?.applicableCustomerTypes);
  const selectedStages = parseStringArray(item?.applicableStages);
  const selectedMaterialIds = parseStringArray(item?.recommendedMaterialIds);
  const keywordText = parseStringArray(item?.keywords).join("\n");
  const forbiddenText = parseStringArray(item?.forbiddenPhrases).join("\n");

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="业务线"
          name="businessLineId"
          options={[{ value: "", label: "不绑定业务线" }, ...businessLines.map((line) => ({ value: line.id, label: line.name }))]}
          defaultValue={item?.businessLineId ?? ""}
        />
        <Select label="知识类型" name="knowledgeType" options={marketClawKnowledgeTypeOptions} defaultValue={item?.knowledgeType ?? "FAQ"} />
        <Select label="状态" name="status" options={marketClawKnowledgeStatusOptions} defaultValue={item?.status ?? "ACTIVE"} />
        <Select label="知识层级" name="scopeLevel" options={marketClawKnowledgeScopeOptions} defaultValue={item?.scopeLevel ?? "BUSINESS_LINE"} />
        <Select label="可见范围" name="visibility" options={marketClawKnowledgeVisibilityOptions} defaultValue={item?.visibility ?? "TENANT"} />
        <Select label="审核状态" name="reviewStatus" options={marketClawKnowledgeReviewStatusOptions} defaultValue={item?.reviewStatus ?? "APPROVED"} />
        <Input label="部门名称" name="departmentName" defaultValue={item?.departmentName ?? ""} />
        <Input label="排序值" name="sortOrder" type="number" defaultValue={String(item?.sortOrder ?? 100)} />
      </div>
      <Input label="标题" name="title" defaultValue={item?.title} required />
      <Textarea label="正文" name="content" defaultValue={item?.content} rows={6} />
      <Textarea label="关键词" name="keywords" defaultValue={keywordText} rows={3} />
      <CheckboxGrid label="适用客户类型" name="applicableCustomerTypes" options={customerTypeOptions} selectedValues={selectedCustomerTypes} />
      <CheckboxGrid label="适用客户阶段" name="applicableStages" options={stageOptions} selectedValues={selectedStages} />
      <MaterialCheckboxes materials={materials} selectedIds={selectedMaterialIds} />
      <Textarea label="不能承诺事项" name="forbiddenPhrases" defaultValue={forbiddenText} rows={3} />
      <Textarea label="风险提醒" name="riskNotes" defaultValue={item?.riskNotes ?? ""} rows={3} />
      <SubmitButton>{item ? "保存知识条目" : "新增知识条目"}</SubmitButton>
    </form>
  );
}

export default async function MarketClawKnowledgePage({
  params,
  searchParams
}: {
  params: { tenantSlug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canAccessMarketClawKnowledge(user.role)) {
    return null;
  }

  const businessLineId = typeof searchParams?.businessLineId === "string" ? searchParams.businessLineId : "";
  const knowledgeType = typeof searchParams?.knowledgeType === "string" ? searchParams.knowledgeType : "";
  const status = typeof searchParams?.status === "string" ? searchParams.status : "";
  const scopeLevel = typeof searchParams?.scopeLevel === "string" ? searchParams.scopeLevel : "";
  const reviewStatus = typeof searchParams?.reviewStatus === "string" ? searchParams.reviewStatus : "";
  const departmentName = typeof searchParams?.departmentName === "string" ? searchParams.departmentName : "";
  const creatorId = typeof searchParams?.creatorId === "string" ? searchParams.creatorId : "";

  const [businessLines, materials, users, knowledgeItems] = await Promise.all([
    prisma.businessLine.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.material.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" }
    }),
    prisma.user.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    }),
    prisma.marketClawKnowledgeItem.findMany({
      where: {
        tenantId: tenant.id,
        ...(businessLineId ? { businessLineId } : {}),
        ...(knowledgeType ? { knowledgeType: knowledgeType as never } : {}),
        ...(status ? { status: status as never } : {}),
        ...(scopeLevel ? { scopeLevel: scopeLevel as never } : {}),
        ...(reviewStatus ? { reviewStatus: reviewStatus as never } : {}),
        ...(departmentName ? { departmentName: { contains: departmentName } } : {}),
        ...(creatorId ? { createdById: creatorId } : {})
      },
      include: { businessLine: true, createdBy: true, updatedBy: true },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }]
    })
  ]);

  const createAction = createMarketClawKnowledgeItem.bind(null, tenant.slug);

  return (
    <PageShell
      tenant={tenant}
      title="Market Claw 知识库"
      breadcrumbs={[
        { label: "Market Claw", href: `/app/${tenant.slug}/market-claw` },
        { label: "知识库" }
      ]}
      description="把企业的产品、服务、案例、FAQ、价格边界、交付流程和不能承诺事项投喂进来。Market Claw 会基于这些知识生成销售回复草稿，避免销售乱说、漏说、说过头。"
    >
      <SectionTabs
        current="knowledge"
        items={[
          { key: "overview", label: "总览", href: `/app/${tenant.slug}/market-claw` },
          { key: "knowledge", label: "知识库", href: `/app/${tenant.slug}/market-claw/knowledge` },
          { key: "training", label: "回复训练场", href: `/app/${tenant.slug}/market-claw/training` },
          { key: "review", label: "训练审核", href: `/app/${tenant.slug}/market-claw/training/review` },
          { key: "replies", label: "回复记录", href: `/app/${tenant.slug}/market-claw/replies` }
        ]}
        className="mb-6"
      />

      <Card className="mb-6 bg-amber-50 border-amber-200">
        <h2 className="text-base font-semibold text-slate-950">投喂原则</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Market Claw 不是让 AI 多说，而是让销售说准。涉及价格、效果、周期、资源名额、评审结果等内容时，应优先使用边界清晰的知识。
        </p>
      </Card>

      <Card>
        <form className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
          <Select
            label="业务线筛选"
            name="businessLineId"
            options={[{ value: "", label: "全部业务线" }, ...businessLines.map((line) => ({ value: line.id, label: line.name }))]}
            defaultValue={businessLineId}
          />
          <Select label="知识类型" name="knowledgeType" options={[{ value: "", label: "全部类型" }, ...marketClawKnowledgeTypeOptions]} defaultValue={knowledgeType} />
          <Select label="状态" name="status" options={[{ value: "", label: "全部状态" }, ...marketClawKnowledgeStatusOptions]} defaultValue={status} />
          <Select label="知识层级" name="scopeLevel" options={[{ value: "", label: "全部层级" }, ...marketClawKnowledgeScopeOptions]} defaultValue={scopeLevel} />
          <Select label="审核状态" name="reviewStatus" options={[{ value: "", label: "全部审核状态" }, ...marketClawKnowledgeReviewStatusOptions]} defaultValue={reviewStatus} />
          <Input label="部门" name="departmentName" defaultValue={departmentName} />
          <Select
            label="创建人"
            name="creatorId"
            options={[{ value: "", label: "全部创建人" }, ...users.map((item) => ({ value: item.id, label: `${item.name} / ${item.role}` }))]}
            defaultValue={creatorId}
          />
          <div className="flex items-end">
            <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">筛选</button>
          </div>
        </form>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-slate-950">新增知识</h2>
          <KnowledgeForm action={createAction} businessLines={businessLines.map((line) => ({ id: line.id, name: line.name }))} materials={materials.map((item) => ({ id: item.id, title: item.title }))} />
        </Card>

        <div className="space-y-4">
          {knowledgeItems.length ? (
            knowledgeItems.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-amber-700">{marketClawKnowledgeTypeOptions.find((option) => option.value === item.knowledgeType)?.label ?? item.knowledgeType}</p>
                    <h2 className="text-lg font-semibold text-slate-950">{item.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {(item.businessLine?.name ?? "通用知识")} / {marketClawKnowledgeStatusOptions.find((option) => option.value === item.status)?.label ?? item.status}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                        {marketClawKnowledgeScopeOptions.find((option) => option.value === item.scopeLevel)?.label ?? item.scopeLevel}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                        {marketClawKnowledgeReviewStatusOptions.find((option) => option.value === item.reviewStatus)?.label ?? item.reviewStatus}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                        {marketClawKnowledgeVisibilityOptions.find((option) => option.value === item.visibility)?.label ?? item.visibility}
                      </span>
                      {item.departmentName ? <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">{item.departmentName}</span> : null}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <p>创建：{item.createdBy.name}</p>
                    <p className="mt-1">更新：{item.updatedBy.name}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-700">{item.content}</p>
                <details className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">编辑这条知识</summary>
                  <div className="mt-4">
                    <KnowledgeForm
                      action={updateMarketClawKnowledgeItem.bind(null, tenant.slug, item.id)}
                      businessLines={businessLines.map((line) => ({ id: line.id, name: line.name }))}
                      materials={materials.map((material) => ({ id: material.id, title: material.title }))}
                      item={item}
                    />
                  </div>
                </details>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm text-slate-500">当前还没有 Market Claw 知识条目，可以先从 FAQ、价格边界和不能承诺事项开始投喂。</p>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
