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

const platformGuideSteps = [
  "第一步：看 dashboard，看今天有哪些客户、主要业务线和顾问任务分布。",
  "第二步：看客户列表，看会员、GEO、乌镇、培训、集采、一清一护等样板客户。",
  "第三步：看整木工厂老板客户详情，看增长诊断、品牌增信、企微中台和下一步动作。",
  "第四步：看会员意向客户详情，看会员权益、增信资料和续费／激活标签。",
  "第五步：看 GEO／AI 推广客户详情，看智能跟进助手、标签建议和诊断资料。",
  "第六步：看活动／乌镇资源客户详情，看活动资源、露出权益和合作路径。",
  "第七步：看销售工作台，看平台销售顾问今天该跟谁、哪些任务逾期。",
  "第八步：看审计日志，看建议生成、标签确认和任务动作都有记录。"
];

const platformCustomerPaths = [
  {
    title: "整木工厂老板客户",
    concerns: "获客、招商、品牌、成交、行业背书、AI 推广、企业微信承接",
    materials: "整木企业增长诊断表、品牌增信方案、企业微信业务增长中台说明、GEO 推广服务说明、增长联盟说明",
    scripts: "先讲客户现在卡在哪，再讲增长诊断、品牌增信和企微承接怎么接上。",
    nextAction: "安排一次增长诊断",
    sampleName: "顾总",
    sampleHref: "/app/zhengmu-platform/leads/platform-lead-001"
  },
  {
    title: "会员意向客户",
    concerns: "加入整木网有什么用、能否增信、有没有露出和客户转化、和普通广告有什么区别",
    materials: "整木网会员服务说明、基础增信服务清单、声望增长服务清单、会员权益说明",
    scripts: "先讲客户当前最缺什么，再讲会员权益和适合的服务层级。",
    nextAction: "发送会员说明并推进会员沟通",
    sampleName: "罗总",
    sampleHref: "/app/zhengmu-platform/leads/platform-lead-005"
  },
  {
    title: "GEO／AI 推广客户",
    concerns: "什么是 GEO、AI 搜索为什么重要、能不能被推荐、和 SEO／代运营有什么区别",
    materials: "GEO 推广服务说明、AI 搜索可见性自查表、关键词与内容底座建设说明",
    scripts: "先讲搜索可见性和品牌信任，再讲诊断、关键词和内容底座。",
    nextAction: "先做 AI 可见性诊断",
    sampleName: "姚总",
    sampleHref: "/app/zhengmu-platform/leads/platform-lead-009"
  },
  {
    title: "活动／乌镇资源客户",
    concerns: "活动有什么价值、有没有峰会榜单白皮书、能否提升影响力、能否链接客户和资源",
    materials: "乌镇设计周合作说明、行业峰会资源说明、榜单与趋势发布说明、品牌露出权益说明",
    scripts: "先讲想拿什么资源，再讲适合的露出、背书和后续承接方式。",
    nextAction: "发送资源包并安排活动合作沟通",
    sampleName: "覃总",
    sampleHref: "/app/zhengmu-platform/leads/platform-lead-017"
  }
];

export default async function DemoGuidePage({ params }: { params: { tenantSlug: string } }) {
  const { tenant } = await requireDemoGuideAccess(params.tenantSlug);
  const sampleBase = `/app/${tenant.slug}`;
  const isPlatformWorkbench = tenant.slug === "zhengmu-platform";
  const pageTitle = isPlatformWorkbench ? "中华整木网自用说明" : "整木行业演示说明";
  const pageDescription = isPlatformWorkbench
    ? "这是整木网自己的业务中台，用于管理会员、GEO、乌镇、培训、集采、一清一护等业务机会。"
    : "这不是普通 CRM，而是一套按客户类型驱动跟进策略的企业微信业务增长中台。";
  const steps = isPlatformWorkbench ? platformGuideSteps : guideSteps;
  const paths = isPlatformWorkbench ? platformCustomerPaths : customerPaths;

  return (
    <PageShell
      tenant={tenant}
      title={pageTitle}
      description={pageDescription}
    >
      <div className="space-y-6">
        <Card>
          <h2 className="text-base font-semibold text-slate-950">系统一句话说明</h2>
          <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
            {isPlatformWorkbench ? (
              <>
                <p>这是整木网自己的业务工作台，不是对外客户样板。</p>
                <p>会员、GEO／AI 推广、乌镇、培训、集采、一清一护、品牌增信和联盟合作，都可以放到一套中台里跟进。</p>
                <p>客户从哪里来、适合推哪条业务线、顾问该发什么资料、老板当天该盯什么，都能看清楚。</p>
              </>
            ) : (
              <>
                <p>客户从哪里来，系统知道；</p>
                <p>客户属于哪一类，系统识别；</p>
                <p>客户该怎么跟，系统提醒；</p>
                <p>销售跟到哪一步，老板看得清。</p>
              </>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-slate-950">推荐演示顺序</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {steps.map((step) => (
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
          {paths.map((path) => (
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
              {isPlatformWorkbench ? (
                <>
                  <p>老板每天要看的不是功能，而是：</p>
                  <p>今天有哪些客户要跟；</p>
                  <p>哪些客户适合推会员；</p>
                  <p>哪些客户适合推 GEO；</p>
                  <p>哪些客户适合推乌镇资源；</p>
                  <p>哪些客户已经高意向；</p>
                  <p>哪些客户该激活。</p>
                </>
              ) : (
                <>
                  <p>老板关心的不是系统有多少功能，而是：</p>
                  <p>客户从哪里来；</p>
                  <p>谁在跟；</p>
                  <p>跟到哪一步；</p>
                  <p>哪些客户高意向；</p>
                  <p>哪些客户要马上处理；</p>
                  <p>哪些销售有逾期任务；</p>
                  <p>哪些客户可以激活。</p>
                </>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-950">{isPlatformWorkbench ? "顾问视角" : "销售视角"}</h2>
            <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
              {isPlatformWorkbench ? (
                <>
                  <p>顾问每天进系统，不是背产品，而是看：</p>
                  <p>今天该跟谁；</p>
                  <p>该发什么资料；</p>
                  <p>该说什么话；</p>
                  <p>该加什么标签；</p>
                  <p>下一步该安排什么任务。</p>
                </>
              ) : (
                <>
                  <p>销售每天进系统，不是看一堆客户，而是看：</p>
                  <p>今天该跟谁；</p>
                  <p>哪些客户逾期；</p>
                  <p>哪些客户高意向；</p>
                  <p>下一句话怎么说；</p>
                  <p>下一份资料发什么；</p>
                  <p>下一步动作是什么。</p>
                </>
              )}
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
