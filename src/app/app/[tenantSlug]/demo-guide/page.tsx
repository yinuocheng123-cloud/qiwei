/*
 * 文件说明：该文件实现 V1.4.1 整木行业演示说明页。
 * 功能说明：在系统内给销售、运营、企业管理员和平台管理员提供统一的演示讲解路径。
 *
 * 结构概览：
 *   第一部分：导入依赖与演示内容常量
 *   第二部分：演示说明页组件
 *   第三部分：通用说明卡片组件
 */
import Link from "next/link";
import { PageShell } from "@/components/Shell";
import { Card } from "@/components/Ui";
import { requireDemoGuideAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

const guideSteps = [
  "第一步：看 dashboard，看客户来源、客户类型、任务和销售概览。",
  "第二步：看客户列表，看 16 条整木行业样板客户。",
  "第三步：看业主客户详情，看案例资料、避坑清单、交付话术和跟进任务。",
  "第四步：看经销商客户详情，看招商资料、政策话术和到厂考察任务。",
  "第五步：看设计师客户详情，看高定案例、工艺节点和项目合作任务。",
  "第六步：看工厂客户详情，看增长诊断、企业微信承接和合作推进任务。",
  "第七步：看销售工作台，看今日任务、逾期任务、高优先级任务和已完成任务。",
  "第八步：看审计日志，看关键动作可追踪。"
];

const customerPaths = [
  {
    title: "业主客户",
    concerns: "效果、环保、价格、交付、售后、设计落地",
    materials: "整木定制避坑清单、真实案例图册、交付流程说明、环保与售后说明",
    scripts: "先讲案例和落地效果，再讲环保、预算和交付边界。",
    nextAction: "预约初步方案",
    sampleName: "陈先生",
    sampleHref: "/app/zhengmu-demo/leads/demo-lead-001"
  },
  {
    title: "经销商客户",
    concerns: "利润、政策、区域保护、总部支持、样板门店、风险",
    materials: "招商手册、产品体系说明、合作政策说明、样板门店案例、到厂考察邀请",
    scripts: "先讲样板门店和总部支持，再讲政策、利润和区域保护。",
    nextAction: "安排招商负责人沟通",
    sampleName: "周总",
    sampleHref: "/app/zhengmu-demo/leads/demo-lead-003"
  },
  {
    title: "设计师客户",
    concerns: "审美、落地、工艺、材料、案例、项目配合",
    materials: "高定案例图册、工艺节点说明、材料样册、设计师合作机制、项目配合流程",
    scripts: "先讲案例和工艺，再讲项目协作、材料配合和报价支持。",
    nextAction: "建立项目合作沟通",
    sampleName: "王设计",
    sampleHref: "/app/zhengmu-demo/leads/demo-lead-004"
  },
  {
    title: "工厂客户",
    concerns: "获客、招商、品牌、成交、企业微信、AI 推广、GEO",
    materials: "企业微信承接自查表、整木企业增长诊断表、品牌增信方案、GEO 推广说明、业务增长中台合作建议",
    scripts: "先讲增长诊断和承接问题，再讲品牌增信、企微协作和合作推进。",
    nextAction: "安排深度诊断",
    sampleName: "赵厂长",
    sampleHref: "/app/zhengmu-demo/leads/demo-lead-005"
  }
];

export default async function DemoGuidePage({ params }: { params: { tenantSlug: string } }) {
  const { tenant } = await requireDemoGuideAccess(params.tenantSlug);
  const sampleBase = `/app/${tenant.slug}`;

  return (
    <PageShell
      tenant={tenant}
      title="整木行业演示说明"
      description="这不是普通 CRM，而是一套按客户类型驱动跟进策略的企业微信业务增长中台。"
    >
      <div className="space-y-6">
        <Card>
          <h2 className="text-base font-semibold text-slate-950">系统一句话说明</h2>
          <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
            <p>客户从哪里来，系统知道；</p>
            <p>客户属于哪一类，系统识别；</p>
            <p>客户该怎么跟，系统提醒；</p>
            <p>销售跟到哪一步，老板看得清。</p>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-slate-950">推荐演示顺序</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {guideSteps.map((step) => (
              <div key={step} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {step}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <QuickLink href={`${sampleBase}/dashboard`} label="打开 dashboard" />
            <QuickLink href={`${sampleBase}/leads`} label="打开客户列表" />
            <QuickLink href={`${sampleBase}/todos`} label="打开销售工作台" />
            <QuickLink href={`${sampleBase}/audit-logs`} label="打开审计日志" />
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          {customerPaths.map((path) => (
            <Card key={path.title}>
              <h2 className="text-base font-semibold text-slate-950">{path.title}</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <GuideLine label="客户关心点" value={path.concerns} />
                <GuideLine label="推荐资料" value={path.materials} />
                <GuideLine label="推荐话术方向" value={path.scripts} />
                <GuideLine label="推荐下一步动作" value={path.nextAction} />
                <div>
                  <p className="font-medium text-slate-950">建议查看的样板客户</p>
                  <Link className="mt-1 inline-block text-emerald-700 underline-offset-2 hover:underline" href={path.sampleHref.replace("/app/zhengmu-demo", sampleBase)}>
                    {path.sampleName}
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">老板视角</h2>
            <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
              <p>老板关心的不是系统有多少功能，而是：</p>
              <p>客户从哪里来；</p>
              <p>谁在跟；</p>
              <p>跟到哪一步；</p>
              <p>哪些客户高意向；</p>
              <p>哪些客户要马上处理；</p>
              <p>哪些销售有逾期任务；</p>
              <p>哪些客户可以激活。</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">销售视角</h2>
            <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
              <p>销售每天进系统，不是看一堆客户，而是看：</p>
              <p>今天该跟谁；</p>
              <p>哪些客户逾期；</p>
              <p>哪些客户高意向；</p>
              <p>下一句话怎么说；</p>
              <p>下一份资料发什么；</p>
              <p>下一步动作是什么。</p>
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-base font-semibold text-slate-950">产品边界</h2>
          <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
            <p>本系统只做企业微信业务增长中台。</p>
            <p>不碰财务、人事、行政、审批、OA。</p>
            <p>不接管企业微信主体。</p>
            <p>企业微信和客户数据归企业。</p>
            <p>系统、模板、策略库和增长中台归平台方。</p>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50" href={href}>
      {label}
    </Link>
  );
}

function GuideLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-slate-950">{label}</p>
      <p className="mt-1 leading-6 text-slate-700">{value}</p>
    </div>
  );
}
