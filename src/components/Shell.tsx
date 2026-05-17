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
import { Breadcrumbs } from "@/components/Ui";

type NavItem = {
  label: string;
  href: string;
};

type NavGroup = {
  label: string;
  href: string;
  description: string;
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
    children:
      role === "SALES"
        ? [{ label: "客户列表", href: `${base}/leads` }]
        : [
            { label: "客户列表", href: `${base}/leads` },
            { label: "客户导入", href: `${base}/imports` },
            { label: "来源归因", href: `${base}/leads#source-attribution` },
            { label: "标签视图", href: `${base}/leads#tag-view` },
            { label: "表单线索", href: `${base}/leads#form-leads` }
          ]
  };

  const todoGroup: NavGroup = {
    label: "跟进工作台",
    href: `${base}/todos`,
    description: "围绕今日待办、逾期任务、已完成记录和任务模板展开日常跟进。",
    children:
      role === "SALES"
        ? [
            { label: "今日待办", href: `${base}/todos#today-tasks` },
            { label: "逾期任务", href: `${base}/todos#overdue-tasks` },
            { label: "已完成", href: `${base}/todos#done-tasks` }
          ]
        : [
            { label: "今日待办", href: `${base}/todos#today-tasks` },
            { label: "逾期任务", href: `${base}/todos#overdue-tasks` },
            { label: "已完成", href: `${base}/todos#done-tasks` },
            { label: "任务模板", href: `${base}/task-templates` }
          ]
  };

  const marketClawGroup: NavGroup = {
    label: "Market Claw",
    href: `${base}/market-claw`,
    description:
      role === "SALES"
        ? "销售从客户详情页使用 Market Claw，也可以做我的训练、保存个人话术并回看回复记录。"
        : "统一承接 Market Claw 总览、知识库、资料投喂、回复训练场、训练审核和回复记录。",
    children:
      role === "SALES"
        ? [
            { label: "Market Claw 总览", href: `${base}/market-claw` },
            { label: "我的训练", href: `${base}/market-claw/training` },
            { label: "我的回复记录", href: `${base}/market-claw/replies` }
          ]
        : [
            { label: "Market Claw 总览", href: `${base}/market-claw` },
            { label: "知识库", href: `${base}/market-claw/knowledge` },
            { label: "资料投喂", href: `${base}/market-claw/ingestion` },
            { label: "回复训练场", href: `${base}/market-claw/training` },
            { label: "训练审核", href: `${base}/market-claw/training/review` },
            { label: "回复记录", href: `${base}/market-claw/replies` }
          ]
  };

  const businessConfigGroup: NavGroup = {
    label: "业务配置",
    href: `${base}/business-lines`,
    description: "把产品总览、资料包、策略库、任务模板和配置入口收口到同一组。",
    children:
      role === "TENANT_ADMIN"
        ? [
            { label: "产品总览", href: `${base}/business-lines` },
            { label: "资料包", href: `${base}/materials` },
            { label: "策略库", href: `${base}/strategies` },
            { label: "任务模板", href: `${base}/task-templates` },
            { label: "企微配置", href: `${base}/wecom` },
            { label: "合规配置", href: `${base}/communication-compliance` }
          ]
        : [
            { label: "产品总览", href: `${base}/business-lines` },
            { label: "资料包", href: `${base}/materials` },
            { label: "策略库", href: `${base}/strategies` },
            { label: "任务模板", href: `${base}/task-templates` },
            { label: "合规配置", href: `${base}/communication-compliance` }
          ]
  };

  const systemGroup: NavGroup = {
    label: "系统管理",
    href: `${base}/permissions`,
    description: "只给高权限角色展示权限说明、审计日志和演示说明等管理入口。",
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
          {groups.map((group) => (
            <div key={group.label} data-nav-group={group.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <Link data-nav-primary="true" className="text-base font-semibold text-slate-950 hover:text-emerald-700" href={group.href}>
                {group.label}
              </Link>
              <p className="mt-2 text-sm leading-6 text-slate-600">{group.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.children.map((item) => (
                  <Link
                    key={`${group.label}-${item.href}`}
                    className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
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
