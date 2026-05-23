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

  const workbenchGroup: NavGroup = {
    label: "工作台",
    href: `${base}/dashboard`,
    description: "销售每天先看今日待跟进、新线索、超期客户和 AI 推荐回复。",
    visibleCount: 2,
    children: [
      { label: "今日工作台", href: `${base}/dashboard`, description: "进入当天销售跟进主线。" },
      { label: "今日待办", href: `${base}/todos?view=today#today-tasks`, description: "先处理今天必须跟进的客户。" },
      { label: "超期客户", href: `${base}/todos?view=overdue#overdue-tasks`, description: "优先清理已经超时的跟进事项。" }
    ]
  };

  const customerGroup: NavGroup = {
    label: "客户",
    href: `${base}/leads`,
    description: role === "SALES" ? "查看自己负责的客户，进入客户详情完成回复和记录。" : "承接客户列表、客户导入、来源归因、标签和表单线索。",
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
    label: "跟进",
    href: `${base}/todos`,
    description: "只围绕今天该跟谁、哪些超期、哪些已完成展开。",
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

  const materialGroup: NavGroup = {
    label: "资料",
    href: `${base}/materials`,
    description: role === "SALES" ? "销售只查沟通资料，不进入 AI 训练和后台治理结构。" : "运营维护销售可用资料，AI 训练作为独立模块承接样本、审核和复盘。",
    visibleCount: 1,
    children:
      role === "SALES"
        ? [{ label: "资料包", href: `${base}/materials`, description: "查找客户沟通可用资料。" }]
        : [
            { label: "资料包", href: `${base}/materials`, description: "维护销售可用资料。" },
            { label: "资料维护说明", href: `${base}/materials`, description: "先把销售常用资料整理清楚，训练样本和审核从 AI训练 进入。" }
          ]
  };

  const aiTrainingGroup: NavGroup = {
    label: "AI训练",
    href: `${base}/market-claw/training`,
    description: "运营和管理员维护回复样本、训练审核和资料投喂；销售只看到客户详情里的 AI 推荐回复结果。",
    visibleCount: 2,
    children: [
      { label: "回复训练", href: `${base}/market-claw/training`, description: "整理销售沉淀的话术样本和训练草稿。" },
      { label: "训练审核", href: `${base}/market-claw/training/review`, description: "审核训练样本、风险边界和可沉淀内容。" },
      { label: "资料投喂", href: `${base}/market-claw/ingestion`, description: "把试点资料整理成候选知识。" },
      { label: "回复记录", href: `${base}/market-claw/replies`, description: "复盘推荐回复生成和使用情况。" },
      { label: "训练复盘", href: `${base}/market-claw/insights`, description: "查看高频问题、知识缺口和训练效果。" }
    ]
  };

  const settingsGroup: NavGroup = {
    label: "设置",
    href: `${base}/settings`,
    description: "系统级低频配置统一收纳，不进入销售主路径；AI 训练已独立给运营承接。",
    visibleCount: 2,
    children: [
      { label: "业务配置", href: `${base}/business-lines`, description: "产品、策略、任务模板等试点基础配置。" },
      { label: "系统设置", href: `${base}/settings`, description: "AI Provider、企微、合规、审计和说明统一入口。" },
      { label: "成员与权限", href: `${base}/permissions`, description: "查看角色边界。" }
    ]
  };

  if (role === "TENANT_ADMIN") {
    return [workbenchGroup, customerGroup, todoGroup, materialGroup, aiTrainingGroup, settingsGroup];
  }

  if (role === "OPERATOR") {
    return [workbenchGroup, customerGroup, todoGroup, materialGroup, aiTrainingGroup, settingsGroup];
  }

  return [workbenchGroup, customerGroup, todoGroup, materialGroup];
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
