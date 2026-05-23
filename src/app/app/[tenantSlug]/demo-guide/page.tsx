/*
 * 文件说明：该文件实现 V1.4.1 平台销售工作台演示说明页。
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
  "第二步：看客户列表，看 16 条通用销售样板客户。",
  "第三步：看潜在客户详情，看案例资料、避坑清单、交付话术和跟进任务。",
  "第四步：看合作伙伴详情，看合作资料、政策话术和现场评估任务。",
  "第五步：看意向客户详情，看成功案例、工艺节点和项目合作任务。",
  "第六步：看重点客户详情，看增长诊断、企业微信承接和合作推进任务。",
  "第七步：看销售工作台，看今日任务、逾期任务、高优先级任务和已完成任务。",
  "第八步：看审计日志，看关键动作可追踪。"
];

const customerPaths = [
  {
    title: "潜在客户",
    concerns: "效果、环保、价格、交付、售后、设计落地",
    materials: "产品服务避坑清单、成功案例、交付流程说明、环保与售后说明",
    scripts: "先讲案例和落地效果，再讲环保、预算和交付边界。",
    nextAction: "预约初步方案",
    sampleName: "陈先生",
    sampleHref: "/app/zhengmu-demo/leads/demo-lead-001"
  },
  {
    title: "合作伙伴",
    concerns: "利润、政策、区域保护、总部支持、样板门店、风险",
    materials: "合作方案、产品体系说明、合作政策说明、样板门店案例、现场评估邀请",
    scripts: "先讲样板门店和总部支持，再讲政策、利润和区域保护。",
    nextAction: "安排合作负责人沟通",
    sampleName: "周总",
    sampleHref: "/app/zhengmu-demo/leads/demo-lead-003"
  },
  {
    title: "意向客户",
    concerns: "审美、落地、工艺、材料、案例、项目配合",
    materials: "成功案例、工艺节点说明、材料样册、方案协作机制、项目配合流程",
    scripts: "先讲案例和工艺，再讲项目协作、材料配合和报价支持。",
    nextAction: "建立项目合作沟通",
    sampleName: "王总",
    sampleHref: "/app/zhengmu-demo/leads/demo-lead-004"
  },
  {
    title: "重点客户",
    concerns: "获客、合作、品牌、成交、企业微信、AI 推广、增长推广",
    materials: "内部提醒承接自查表、客户增长诊断表、信任建设方案、增长推广说明、销售协作工作台合作建议",
    scripts: "先讲增长诊断和承接问题，再讲信任建设、企微协作和合作推进。",
    nextAction: "安排深度诊断",
    sampleName: "赵厂长",
    sampleHref: "/app/zhengmu-demo/leads/demo-lead-005"
  }
];

const platformGuideSteps = [
  "第一步：看 dashboard，看今天有哪些客户、主要业务线和顾问任务分布。",
  "第二步：看客户列表，看会员、增长推广、活动、培训、集采、一清一护等样板客户。",
  "第三步：看重点客户详情，看增长诊断、信任建设、内部提醒通道和下一步动作。",
  "第四步：看会员意向客户详情，看会员权益、增信资料和续费／激活标签。",
  "第五步：看增长推广客户详情，看智能跟进助手、标签建议和诊断资料。",
  "第六步：看活动／活动资源客户详情，看活动资源、露出权益和合作路径。",
  "第七步：看销售工作台，看平台销售顾问今天该跟谁、哪些任务逾期。",
  "第八步：看审计日志，看建议生成、标签确认和任务动作都有记录。"
];

const platformCustomerPaths = [
  {
    title: "重点客户",
    concerns: "获客、合作、品牌、成交、行业背书、AI 推广、企业微信承接",
    materials: "客户增长诊断表、信任建设方案、客户跟进与销售协作工作台说明、增长推广服务说明、增长联盟说明",
    scripts: "先讲客户现在卡在哪，再讲增长诊断、信任建设和内部提醒承接怎么接上。",
    nextAction: "安排一次增长诊断",
    sampleName: "顾总",
    sampleHref: "/app/zhengmu-platform/leads/platform-lead-001"
  },
  {
    title: "会员意向客户",
    concerns: "加入MarketClaw有什么用、能否增信、有没有露出和客户转化、和普通广告有什么区别",
    materials: "MarketClaw会员服务说明、基础增信服务清单、声望增长服务清单、会员权益说明",
    scripts: "先讲客户当前最缺什么，再讲会员权益和适合的服务层级。",
    nextAction: "发送会员说明并推进会员沟通",
    sampleName: "罗总",
    sampleHref: "/app/zhengmu-platform/leads/platform-lead-005"
  },
  {
    title: "增长推广客户",
    concerns: "什么是增长推广、AI 搜索为什么重要、能不能被推荐、和 SEO／代运营有什么区别",
    materials: "增长推广服务说明、AI 搜索可见性自查表、关键词与内容底座建设说明",
    scripts: "先讲搜索可见性和品牌信任，再讲诊断、关键词和内容底座。",
    nextAction: "先做 AI 可见性诊断",
    sampleName: "姚总",
    sampleHref: "/app/zhengmu-platform/leads/platform-lead-009"
  },
  {
    title: "活动／活动资源客户",
    concerns: "活动有什么价值、有没有峰会榜单白皮书、能否提升影响力、能否链接客户和资源",
    materials: "活动合作说明、行业峰会资源说明、榜单与趋势发布说明、品牌露出权益说明",
    scripts: "先讲想拿什么资源，再讲适合的露出、背书和后续承接方式。",
    nextAction: "发送资源包并安排活动合作沟通",
    sampleName: "覃总",
    sampleHref: "/app/zhengmu-platform/leads/platform-lead-017"
  }
];

export default async function DemoGuidePage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireDemoGuideAccess(params.tenantSlug);
  const sampleBase = `/app/${tenant.slug}`;
  const isPlatformWorkbench = tenant.slug === "zhengmu-platform";
  const pageTitle = isPlatformWorkbench ? "MarketClaw 平台工作台说明" : "平台销售工作台演示说明";
  const pageDescription = isPlatformWorkbench
    ? "这是MarketClaw 自己的业务中台，用于管理会员、增长推广、活动、培训、集采、一清一护等业务机会。"
    : "这不是普通 CRM，而是一套按客户类型驱动跟进策略的客户跟进与销售协作工作台。";
  const steps = isPlatformWorkbench ? platformGuideSteps : guideSteps;
  const paths = isPlatformWorkbench ? platformCustomerPaths : customerPaths;
  const quickLinks =
    user.role === "PLATFORM_ADMIN"
      ? [
          { href: "/admin", label: "返回平台后台" },
          { href: "/admin/audit-logs", label: "打开平台审计日志" }
        ]
      : user.role === "TENANT_ADMIN"
        ? [
            { href: `${sampleBase}/dashboard`, label: "打开 dashboard" },
            { href: `${sampleBase}/leads`, label: "打开客户列表" },
            { href: `${sampleBase}/business-lines`, label: "打开业务线／产品" },
            { href: `${sampleBase}/todos`, label: "打开销售工作台" },
            { href: `${sampleBase}/audit-logs`, label: "打开审计日志" }
          ]
        : user.role === "OPERATOR"
          ? [
              { href: `${sampleBase}/dashboard`, label: "打开 dashboard" },
              { href: `${sampleBase}/leads`, label: "打开客户列表" },
              { href: `${sampleBase}/business-lines`, label: "打开业务线／产品" },
              { href: `${sampleBase}/materials`, label: "打开资料包" },
              { href: `${sampleBase}/strategies`, label: "打开策略库" },
              { href: `${sampleBase}/task-templates`, label: "打开任务模板" }
            ]
          : [
              { href: `${sampleBase}/dashboard`, label: "打开 dashboard" },
              { href: `${sampleBase}/leads`, label: "打开我的客户" },
              { href: `${sampleBase}/todos`, label: "打开销售工作台" }
            ];
  const roleGuide =
    user.role === "PLATFORM_ADMIN"
      ? {
          title: "平台维护提示",
          lines: [
            "当前访问主要用于演示查看，不参与租户日常业务跟进。",
            "平台管理员主要负责租户、配置、安全和审计。",
            "租户业务线、客户资料和顾问任务仍由企业角色维护。"
          ]
        }
      : user.role === "TENANT_ADMIN"
        ? {
            title: "老板／企业管理员视角",
            lines: [
              "重点看客户从哪里来、哪些业务线在跑、哪些客户高意向。",
              "重点盯销售是否有逾期任务、哪些客户该激活、哪些业务需要调整。",
              "如果要改业务方向，优先去业务线／产品、资料包、策略库和任务模板页面统一调整。"
            ]
          }
        : user.role === "OPERATOR"
          ? {
              title: "运营视角",
              lines: [
                "重点维护业务线、资料包、策略库和任务模板，让顾问拿到一致的跟进资产。",
                "重点配合内容、私域和活动运营，检查客户分类、推荐资料和标签建议是否合理。",
                "运营不处理平台审计和敏感企微配置，避免越权进入高风险入口。"
              ]
            }
          : {
              title: "销售视角",
              lines: [
                "每天先看销售工作台和自己负责的客户，明确今天该跟谁。",
                "进入客户详情后，用智能跟进助手复制建议回复，再人工修改后发送。",
                "看到智能标签建议后手动确认，再保存跟进记录和下一步任务。"
              ]
            };

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
                <p>这是MarketClaw 自己的业务工作台，不是对外客户样板。</p>
                <p>会员、增长推广、活动、培训、集采、一清一护、信任建设和联盟合作，都可以放到一套中台里跟进。</p>
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
          <h2 className="text-base font-semibold text-slate-950">{roleGuide.title}</h2>
          <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
            {roleGuide.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
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
            {quickLinks.map((item) => (
              <QuickLink key={item.href} href={item.href} label={item.label} />
            ))}
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
                  <p>哪些客户适合推增长推广；</p>
                  <p>哪些客户适合推活动资源；</p>
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
            <p>本系统只做客户跟进与销售协作工作台。</p>
            <p>不碰财务、人事、行政、审批、OA。</p>
            <p>不接管企业微信主体。</p>
            <p>企业微信和客户数据归企业。</p>
            <p>系统、模板、策略库和销售协作工作台归平台方。</p>
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
