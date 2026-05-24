import Link from "next/link";
import { Card } from "@/components/Ui";
import { PageShell } from "@/components/Shell";
import { requireDemoGuideAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

const guideSteps = [
  "第一步：打开工作台，看今天待跟进客户、逾期任务和 AI 推荐回复建议。",
  "第二步：进入客户列表，先按潜在客户、意向客户、合作伙伴和重点客户分组查看。",
  "第三步：打开客户详情，看资料、跟进记录、下一步任务和风险提示。",
  "第四步：进入资料页，先看销售资料清单，再决定今天发哪一组资料。",
  "第五步：运营和管理员查看 AI 训练、设置、审计和治理入口，销售侧不需要记住这些入口。",
  "第六步：有新线索时，从导入或表单进入工作台，不要跳过客户分配和首次跟进。",
  "第七步：每天先处理高优先级客户，再补资料、补记录、补下一步任务。",
  "第八步：把有价值的回复和资料沉淀下来，继续优化团队标准做法。"
];

const customerPaths = [
  {
    title: "潜在客户",
    concerns: "需求、预算、时间、资料是否清楚",
    materials: "产品介绍、成功案例、服务流程、常见问题",
    scripts: "先讲能解决什么问题，再讲下一步怎么推进。",
    nextAction: "安排首次沟通",
    sampleName: "查看潜在客户样例"
  },
  {
    title: "意向客户",
    concerns: "方案、比较、节奏、是否适合继续推进",
    materials: "产品介绍、报价说明、成功案例、服务流程",
    scripts: "先讲方案边界和节奏，再讲如何确认下一步。",
    nextAction: "补充资料并推进沟通",
    sampleName: "查看意向客户样例"
  },
  {
    title: "合作伙伴",
    concerns: "合作政策、资源协同、边界、推进方式",
    materials: "合作方案、报价说明、服务流程、常见问题",
    scripts: "先讲合作方式，再讲双方怎么配合。",
    nextAction: "安排合作沟通",
    sampleName: "查看合作伙伴样例"
  },
  {
    title: "重点客户",
    concerns: "报价、交付、风险、复盘和持续跟进",
    materials: "企业增长诊断表、客户承接自查表、销售话术说明、客户跟进流程",
    scripts: "先讲当前卡点，再讲如何把问题拆成下一步动作。",
    nextAction: "安排深度诊断",
    sampleName: "查看重点客户样例"
  }
];

export default async function DemoGuidePage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireDemoGuideAccess(params.tenantSlug);
  const sampleBase = `/app/${tenant.slug}`;
  const quickLinks =
    user.role === "PLATFORM_ADMIN"
      ? [
          { href: "/admin", label: "返回平台后台" },
          { href: "/admin/audit-logs", label: "打开平台审计日志" }
        ]
      : user.role === "TENANT_ADMIN"
        ? [
            { href: `${sampleBase}/dashboard`, label: "打开工作台" },
            { href: `${sampleBase}/leads`, label: "打开客户列表" },
            { href: `${sampleBase}/materials`, label: "打开资料清单" },
            { href: `${sampleBase}/settings`, label: "打开设置" }
          ]
        : user.role === "OPERATOR"
          ? [
              { href: `${sampleBase}/dashboard`, label: "打开工作台" },
              { href: `${sampleBase}/leads`, label: "打开客户列表" },
              { href: `${sampleBase}/materials`, label: "打开资料清单" },
              { href: `${sampleBase}/market-claw`, label: "打开 MarketClaw" }
            ]
          : [
              { href: `${sampleBase}/dashboard`, label: "打开工作台" },
              { href: `${sampleBase}/leads`, label: "打开客户列表" },
              { href: `${sampleBase}/materials`, label: "打开资料清单" }
            ];

  const roleGuide =
    user.role === "PLATFORM_ADMIN"
      ? {
          title: "平台管理员视角",
          lines: ["平台管理员看租户状态、治理和配置，不参与租户的日常销售跟进。"]
        }
      : user.role === "TENANT_ADMIN"
        ? {
            title: "企业管理员视角",
            lines: [
              "重点看客户分组、资料清单、工作台节奏和本周优先动作。",
              "需要时再进入设置、AI 训练和治理页面。"
            ]
          }
        : user.role === "OPERATOR"
          ? {
              title: "运营视角",
              lines: [
                "重点维护资料、训练样本、客户分组和流程标准。",
                "运营可以协助整理资料，但不替销售做最终动作。"
              ]
            }
          : {
              title: "销售视角",
              lines: [
                "销售只看工作台、客户、跟进和资料。",
                "先处理今天该跟谁、该发什么、下一步做什么。"
              ]
            };

  return (
    <PageShell
      tenant={tenant}
      title="MarketClaw 销售助手平台说明"
      description="这是客户跟进与销售协作工作台，不是行业演示系统。AI 和企业微信都只是可选连接能力预留。"
    >
      <div className="space-y-6">
        <Card>
          <h2 className="text-base font-semibold text-slate-950">系统一句话说明</h2>
          <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
            <p>这是 MarketClaw 销售助手平台底座，核心是客户、跟进、资料、下一步任务和工作台。</p>
            <p>AI 推荐回复只是辅助建议，企业微信只作为后续连接器或内部提醒通道预留。</p>
            <p>销售只负责跟进和确认，资料和治理由运营与管理员维护。</p>
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
            {guideSteps.map((step) => (
              <div key={step} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {step}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {quickLinks.map((item) => (
              <Link key={item.href} className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50" href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          {customerPaths.map((path) => (
            <Card key={path.title}>
              <h2 className="text-base font-semibold text-slate-950">{path.title}</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <GuideLine label="关注点" value={path.concerns} />
                <GuideLine label="推荐资料" value={path.materials} />
                <GuideLine label="推荐话术方向" value={path.scripts} />
                <GuideLine label="下一步动作" value={path.nextAction} />
                <GuideLine label="建议查看" value={path.sampleName} />
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <h2 className="text-base font-semibold text-slate-950">产品边界</h2>
          <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
            <p>本系统只做客户跟进与销售协作工作台。</p>
            <p>不做自动替销售回复客户，不做自动发送，不把 AI 描述为自动闭环。</p>
            <p>AI 与企业微信都保留为可选连接能力和后续扩展方向。</p>
          </div>
        </Card>
      </div>
    </PageShell>
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
