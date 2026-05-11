/*
 * 文件说明：该文件实现客户详情页。
 * 功能说明：展示客户基础信息、标签、跟进记录，并按客户类型匹配策略库推荐话术和资料。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：详情页查询
 *   第三部分：客户信息、策略推荐与跟进表单
 */
import { notFound } from "next/navigation";
import { addFollowUp } from "@/lib/actions";
import { requireLeadAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerTypeOptions, formatDate, intentionOptions, labelOf, needTypeOptions, sourceOptions, stageOptions } from "@/lib/options";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { tenantSlug: string; id: string } }) {
  const { tenant } = await requireLeadAccess(params.tenantSlug, params.id);
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, tenantId: tenant.id },
    include: {
      owner: true,
      tags: true,
      followUps: { include: { user: true }, orderBy: { createdAt: "desc" } }
    }
  });

  if (!lead) notFound();

  const [strategy, materials] = await Promise.all([
    prisma.customerTypeStrategy.findUnique({
      where: { tenantId_customerType: { tenantId: tenant.id, customerType: lead.customerType } }
    }),
    prisma.material.findMany({
      where: { tenantId: tenant.id, OR: [{ customerType: lead.customerType }, { customerType: null }] },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const followAction = addFollowUp.bind(null, tenant.slug, lead.id);

  return (
    <PageShell tenant={tenant} title={`客户详情：${lead.name}`} description="策略推荐来自 CustomerTypeStrategy，是本项目区别于普通 CRM 的核心模块。">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-base font-semibold">客户基础信息</h2>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <Info label="电话" value={lead.phone} />
              <Info label="微信" value={lead.wechat} />
              <Info label="公司" value={lead.company} />
              <Info label="城市" value={lead.city} />
              <Info label="来源渠道" value={labelOf(sourceOptions, lead.source)} />
              <Info label="客户类型" value={labelOf(customerTypeOptions, lead.customerType)} />
              <Info label="需求类型" value={labelOf(needTypeOptions, lead.needType)} />
              <Info label="意向等级" value={labelOf(intentionOptions, lead.intentionLevel)} />
              <Info label="当前阶段" value={labelOf(stageOptions, lead.stage)} />
              <Info label="负责人" value={lead.owner?.name} />
              <Info label="下次跟进" value={formatDate(lead.nextFollowAt)} />
              <Info label="最后跟进" value={formatDate(lead.lastFollowAt)} />
            </div>
            {lead.message ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{lead.message}</p> : null}
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold">标签</h2>
            <div className="flex flex-wrap gap-2">
              {lead.tags.length ? (
                lead.tags.map((tag) => (
                  <span key={tag.id} className="rounded-md bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                    {tag.tagName}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">暂无标签</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold">销售跟进记录</h2>
            <div className="space-y-3">
              {lead.followUps.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2 text-slate-500">
                    <span>{item.user.name}</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-slate-800">{item.content}</p>
                  <p className="mt-2 text-slate-500">下一步：{item.nextAction ?? "-"}</p>
                  <p className="text-slate-500">
                    阶段：{labelOf(stageOptions, item.stageBefore)} → {labelOf(stageOptions, item.stageAfter)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-4 text-base font-semibold">推荐转化策略</h2>
            {strategy ? (
              <div className="space-y-4 text-sm">
                <StrategyBlock title="欢迎语模板" value={strategy.welcomeScript} />
                <StrategyBlock title="首发资料" value={strategy.firstMaterials.join("、")} />
                <StrategyBlock title="3天跟进话术" value={strategy.day3Script} />
                <StrategyBlock title="7天跟进话术" value={strategy.day7Script} />
                <StrategyBlock title="15天激活话术" value={strategy.day15Script} />
                <StrategyBlock title="人工介入条件" value={strategy.manualTriggerRules.join("、")} />
                <StrategyBlock title="推荐下一步动作" value={strategy.recommendedNextAction} />
                <StrategyBlock title="推荐私域内容" value={strategy.recommendedPrivateContent} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">当前客户类型暂未配置策略。</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold">推荐资料</h2>
            <div className="space-y-2 text-sm">
              {materials.length ? (
                materials.map((material) => (
                  <a key={material.id} className="block rounded-md border border-slate-200 px-3 py-2 text-emerald-700" href={material.url} target="_blank">
                    {material.title}
                  </a>
                ))
              ) : (
                <p className="text-slate-500">暂无匹配资料。</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold">新增跟进</h2>
            <form action={followAction} className="space-y-4">
              <Textarea label="跟进内容" name="content" rows={4} />
              <Input label="下一步动作" name="nextAction" defaultValue={strategy?.recommendedNextAction ?? ""} />
              <Select label="更新阶段" name="stageAfter" options={stageOptions} defaultValue={lead.stage} />
              <Input label="下次跟进时间" name="nextFollowAt" type="datetime-local" />
              <SubmitButton>保存跟进</SubmitButton>
            </form>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value ?? "-"}</p>
    </div>
  );
}

function StrategyBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-slate-950">{title}</p>
      <p className="mt-1 leading-6 text-slate-700">{value || "-"}</p>
    </div>
  );
}
