/*
 * 文件说明：该页面实现 V2.2 的租户系统设置收口入口。
 * 功能说明：把 AI Provider、企业微信、合规、审计和权限说明等系统级低频入口统一收纳，AI 训练改为独立运营模块，避免被设置页吞掉。
 *
 * 结构概览：
 *   第一部分：导入依赖与入口卡片
 *   第二部分：系统设置页面渲染
 */
import Link from "next/link";
import { PageShell } from "@/components/Shell";
import { Card, Callout } from "@/components/Ui";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SettingLink = {
  title: string;
  description: string;
  href: string;
};

function SettingCard({ title, description, href }: SettingLink) {
  return (
    <Card className="h-full">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <Link className="mt-4 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" href={href}>
        打开
      </Link>
    </Card>
  );
}

function SettingGroup({ title, description, items }: { title: string; description: string; items: SettingLink[] }) {
  return (
    <section className="mt-6">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <SettingCard key={item.href} {...item} />
        ))}
      </div>
    </section>
  );
}

export default async function SettingsPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const base = `/app/${tenant.slug}`;
  const isAdmin = user.role === "TENANT_ADMIN";

  const businessItems: SettingLink[] = [
    { title: "业务线", description: "维护试点期产品、服务和业务承接范围。", href: `${base}/business-lines` },
    { title: "产品/服务", description: "进入业务配置，检查产品说明、适合客户和风险边界。", href: `${base}/business-lines` },
    { title: "资料包", description: "整理销售可发送给客户的资料。", href: `${base}/materials` },
    { title: "任务模板", description: "维护标准跟进动作，帮助销售知道下一步做什么。", href: `${base}/task-templates` }
  ];

  const aiGovernanceItems: SettingLink[] = [
    { title: "知识维护", description: "维护 AI 推荐回复可引用的正式知识。", href: `${base}/market-claw/knowledge` },
    { title: "AI 测试沙盒", description: "内部测试回复建议和风险提示，不用于客户侧自动回复。", href: `${base}/market-claw/sandbox` },
    { title: "洞察复盘", description: "查看高频问题、知识缺口和试点运营复盘。", href: `${base}/market-claw/insights` },
    { title: "AI Provider", description: "配置模型调用能力，只服务后台治理和推荐回复能力。", href: `${base}/ai-settings` }
  ];

  const wecomItems: SettingLink[] = [
    { title: "企业微信配置", description: "配置内部提醒能力，不做客户侧自动沟通。", href: `${base}/wecom` },
    { title: "成员绑定", description: "维护系统用户与企业微信成员的绑定关系。", href: `${base}/wecom` },
    { title: "内部提醒", description: "用于把负责人拉回系统处理跟进和审核。", href: `${base}/wecom` },
    { title: "通知日志", description: "查看内部提醒发送、跳过或失败记录。", href: `${base}/wecom` }
  ];

  const complianceItems: SettingLink[] = [
    { title: "沟通合规配置", description: "维护沟通素材、客户提示和数据保留边界。", href: `${base}/communication-compliance` },
    { title: "权限说明", description: "查看管理员、运营和销售的角色边界。", href: `${base}/permissions` },
    ...(isAdmin ? [{ title: "审计日志", description: "查看关键操作记录，辅助试点复盘和责任追踪。", href: `${base}/audit-logs` }] : [])
  ];

  return (
    <PageShell
      tenant={tenant}
      title="系统设置"
      breadcrumbs={[
        { label: "工作台", href: `${base}/dashboard` },
        { label: "系统设置" }
      ]}
      description="系统级低频配置统一收纳在这里，不进入销售每天使用的客户跟进主线；AI 训练已独立给运营和管理员承接。"
    >
      <Callout title="试点期使用原则" tone="amber">
        设置页只服务管理员和运营做系统级后台治理。销售不需要理解 Provider、Prompt、合规策略或通知配置，只需要在客户详情页确认 AI 推荐回复能不能发；训练样本、训练审核和资料投喂从独立的 AI训练 模块进入。
      </Callout>

      <SettingGroup title="业务基础" description="业务基础用于试点前配置产品、资料和标准跟进动作。" items={businessItems} />
      <SettingGroup title="AI 治理" description="这里保留模型配置、知识维护、测试和复盘等系统级治理入口；回复训练、训练审核和资料投喂已提升为独立 AI训练 模块。" items={aiGovernanceItems} />
      <SettingGroup title="企业微信与提醒" description="企业微信当前只用于内部提醒和配置预留，不描述为客户侧自动回复闭环。" items={wecomItems} />
      <SettingGroup title="合规与审计" description="合规和审计只服务后台治理与试点复盘，不进入销售主路径。" items={complianceItems} />
    </PageShell>
  );
}
