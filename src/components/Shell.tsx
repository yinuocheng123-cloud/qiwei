/*
 * 文件说明：该文件提供平台后台与租户后台共用的页面壳和导航。
 * 功能说明：按角色输出收口后的一级导航分组，避免把功能平铺成一长串菜单。
 *
 * 结构概览：
 *   第一部分：导航类型定义
 *   第二部分：平台侧与租户侧导航配置
 *   第三部分：导航渲染与页面壳组件
 */
import Link from "next/link";
import type { Tenant, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { Breadcrumbs, ModuleMoreMenu } from "@/components/Ui";

type NavItem = {
  label: string;
  href: string;
  description?: string;
};

type NavGroup = {
  label: string;
  href: string;
  description: string;
  visibleCount: number;
  children: NavItem[];
};

function buildPlatformNavItems(): NavItem[] {
  return [
    { label: "租户管理", href: "/admin" },
    { label: "平台审计日志", href: "/admin/audit-logs" }
  ];
}

function buildTenantNavGroups(tenant: Tenant, role: UserRole): NavGroup[] {
  const base = `/app/${tenant.slug}`;

  if (role === "PLATFORM_ADMIN") {
    return [
      {
        label: "平台侧入口",
        href: "/admin",
        description: "平台管理员仍以平台后台和演示说明为主，不混入租户日常业务导航。",
        visibleCount: 2,
        children: [
          { label: "平台后台", href: "/admin" },
          { label: "平台审计日志", href: "/admin/audit-logs" },
          { label: "演示说明", href: `${base}/demo-guide` }
        ]
      }
    ];
  }

  const homeGroup: NavGroup = {
    label: "首页",
    href: `${base}/dashboard`,
    description: "集中查看今日重点、待办提醒、高意向客户、逾期任务和最近新增线索。",
    visibleCount: role === "SALES" ? 2 : 3,
    children:
      role === "SALES"
        ? [
            { label: "总览看板", href: `${base}/dashboard` },
            { label: "演示说明", href: `${base}/demo-guide` }
          ]
        : [
            { label: "总览看板", href: `${base}/dashboard` },
            { label: "初始化向导", href: `${base}/onboarding` },
            { label: "演示说明", href: `${base}/demo-guide` }
          ]
  };

  const customerGroup: NavGroup = {
    label: "客户管理",
    href: `${base}/leads`,
    description: "把客户列表、导入、来源归因、标签视图和表单线索收口到同一入口。",
    visibleCount: role === "SALES" ? 1 : 2,
    children:
      role === "SALES"
        ? [{ label: "客户列表", href: `${base}/leads` }]
        : [
            { label: "客户列表", href: `${base}/leads`, description: "查看、筛选并进入客户详情。" },
            { label: "客户导入", href: `${base}/imports`, description: "批量导入历史客户和活动名单。" },
            { label: "来源归因", href: `${base}/leads?view=source#source-attribution`, description: "回看渠道、活动和页面来源。" },
            { label: "标签视图", href: `${base}/leads?view=tags#tag-view`, description: "按标签分组查看客户结构。" },
            { label: "表单线索", href: `${base}/leads?view=forms#form-leads`, description: "查看公开表单流入线索。" }
          ]
  };

  const todoGroup: NavGroup = {
    label: "跟进工作台",
    href: `${base}/todos`,
    description: "围绕今日待办、逾期任务、已完成记录和任务模板展开日常跟进。",
    visibleCount: 2,
    children:
      role === "SALES"
        ? [
            { label: "今日待办", href: `${base}/todos?view=today#today-tasks`, description: "先处理今天必须跟进的客户。" },
            { label: "逾期任务", href: `${base}/todos?view=overdue#overdue-tasks`, description: "优先清理已经超时的任务。" },
            { label: "已完成", href: `${base}/todos?view=done#done-tasks`, description: "回看已完成任务和推进节奏。" }
          ]
        : [
            { label: "今日待办", href: `${base}/todos?view=today#today-tasks`, description: "查看今天应处理的跟进任务。" },
            { label: "逾期任务", href: `${base}/todos?view=overdue#overdue-tasks`, description: "集中处理超时未跟进事项。" },
            { label: "已完成", href: `${base}/todos?view=done#done-tasks`, description: "查看已经完成的任务记录。" },
            { label: "任务模板", href: `${base}/task-templates`, description: "维护标准化跟进任务模板。" }
          ]
  };

  const marketClawGroup: NavGroup = {
    label: "Market Claw",
    href: `${base}/market-claw`,
    description:
      role === "SALES"
        ? "销售从客户详情页使用 Market Claw，也可以做我的训练、保存个人话术并回看回复记录。"
        : "统一承接 Market Claw 总览、知识库、资料投喂、回复训练场、训练审核和回复记录。",
    visibleCount: role === "SALES" ? 2 : 2,
    children:
      role === "SALES"
        ? [
            { label: "Market Claw 总览", href: `${base}/market-claw`, description: "查看销售侧使用路径。" },
            { label: "我的训练", href: `${base}/market-claw/training`, description: "沉淀个人常用话术。" },
            { label: "我的回复记录", href: `${base}/market-claw/replies`, description: "回看自己生成过的回复。" },
            { label: "训练复盘", href: `${base}/market-claw/insights`, description: "查看个人训练表现。" }
          ]
        : [
            { label: "Market Claw 总览", href: `${base}/market-claw`, description: "进入模块总览和角色路径。" },
            { label: "AI 测试沙盒", href: `${base}/market-claw/sandbox`, description: "内部测试 Provider、专家视角和风险分级。" },
            { label: "知识库", href: `${base}/market-claw/knowledge`, description: "维护产品、FAQ、案例和边界知识。" },
            { label: "资料投喂", href: `${base}/market-claw/ingestion`, description: "把资料拆成候选知识并人工审核。" },
            { label: "回复训练场", href: `${base}/market-claw/training`, description: "模拟客户问题并沉淀训练样本。" },
            { label: "训练审核", href: `${base}/market-claw/training/review`, description: "审核销售提交的话术样本。" },
            { label: "回复记录", href: `${base}/market-claw/replies`, description: "复盘实际生成和使用记录。" },
            { label: "训练复盘", href: `${base}/market-claw/insights`, description: "查看知识治理与训练表现。" }
          ]
  };

  const businessConfigGroup: NavGroup = {
    label: "业务配置",
    href: `${base}/business-lines`,
    description: "把产品总览、资料包、策略库、任务模板和配置入口收口到同一组。",
    visibleCount: 2,
    children:
      role === "TENANT_ADMIN"
        ? [
            { label: "产品总览", href: `${base}/business-lines`, description: "查看业务线和产品配置状态。" },
            { label: "AI 能力配置", href: `${base}/ai-settings`, description: "配置和测试租户 AI Provider。" },
            { label: "资料包", href: `${base}/materials`, description: "维护销售可使用的资料资产。" },
            { label: "策略库", href: `${base}/strategies`, description: "维护客户类型策略和推荐动作。" },
            { label: "任务模板", href: `${base}/task-templates`, description: "维护标准跟进任务模板。" },
            { label: "合规配置", href: `${base}/communication-compliance`, description: "维护沟通素材采集边界。" },
            { label: "企业微信提醒配置", href: `${base}/wecom`, description: "配置内部提醒和成员绑定。" }
          ]
        : [
            { label: "产品总览", href: `${base}/business-lines`, description: "查看和维护业务线配置。" },
            { label: "AI 能力配置", href: `${base}/ai-settings`, description: "查看状态并执行测试连接。" },
            { label: "资料包", href: `${base}/materials`, description: "维护销售资料资产。" },
            { label: "策略库", href: `${base}/strategies`, description: "维护客户类型策略。" },
            { label: "任务模板", href: `${base}/task-templates`, description: "维护标准任务模板。" },
            { label: "合规配置", href: `${base}/communication-compliance`, description: "维护沟通素材边界。" }
          ]
  };

  const systemGroup: NavGroup = {
    label: "系统管理",
    href: `${base}/permissions`,
    description: "只给高权限角色展示权限说明、审计日志和演示说明等管理入口。",
    visibleCount: 2,
    children: [
      { label: "权限说明", href: `${base}/permissions` },
      { label: "审计日志", href: `${base}/audit-logs` },
      { label: "演示说明", href: `${base}/demo-guide` }
    ]
  };

  if (role === "TENANT_ADMIN") {
    return [homeGroup, customerGroup, todoGroup, marketClawGroup, businessConfigGroup, systemGroup];
  }

  if (role === "OPERATOR") {
    return [homeGroup, customerGroup, todoGroup, marketClawGroup, businessConfigGroup];
  }

  return [homeGroup, customerGroup, todoGroup, marketClawGroup];
}

function PlatformNavBar({ items }: { items: NavItem[] }) {
  return (
    <nav className="border-b border-slate-200 bg-white px-6 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
        {items.map((item) => (
          <Link key={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href={item.href}>
            {item.label}
          </Link>
        ))}
        <Link className="ml-auto rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white" href="/logout">
          退出
        </Link>
      </div>
    </nav>
  );
}

function TenantNavBar({ groups }: { groups: NavGroup[] }) {
  return (
    <nav className="border-b border-slate-200 bg-slate-50/80 px-6 py-4">
      <div className="mx-auto max-w-7xl">
        <div className={`grid gap-3 ${groups.length >= 6 ? "xl:grid-cols-3" : groups.length >= 4 ? "lg:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2"}`}>
          {groups.map((group) => {
            const visibleItems = group.children.slice(0, group.visibleCount);
            const moreItems = group.children.slice(group.visibleCount).map((item) => ({
              title: item.label,
              href: item.href,
              description: item.description
            }));

            return (
            <div key={group.label} data-nav-group={group.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <Link data-nav-primary="true" className="text-base font-semibold text-slate-950 hover:text-emerald-700" href={group.href}>
                {group.label}
              </Link>
              <p className="mt-2 text-sm leading-6 text-slate-600">{group.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {visibleItems.map((item) => (
                  <Link
                    key={`${group.label}-${item.href}`}
                    data-nav-shortcut="visible"
                    className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
                <ModuleMoreMenu
                  className="w-full md:w-auto"
                  items={moreItems}
                />
              </div>
            </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href="/logout">
            退出
          </Link>
        </div>
      </div>
    </nav>
  );
}

async function ShellNav({ tenant }: { tenant?: Tenant }) {
  const user = await getCurrentUser();
  if (!user) return null;

  if (tenant) {
    return <TenantNavBar groups={buildTenantNavGroups(tenant, user.role)} />;
  }

  if (user.role === "PLATFORM_ADMIN") {
    return <PlatformNavBar items={buildPlatformNavItems()} />;
  }

  return null;
}

export async function PageShell({
  tenant,
  title,
  description,
  breadcrumbs,
  children
}: {
  tenant?: Tenant;
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <ShellNav tenant={tenant} />
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6">
          {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} className="mb-3" /> : null}
          <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
          {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
        </div>
        {children}
      </section>
    </main>
  );
}
