/*
 * 文件说明：该文件提供平台后台和租户后台的通用导航与页面壳。
 * 功能说明：根据当前登录角色动态展示不同菜单，收口高风险入口，避免各页面重复拼导航。
 *
 * 结构概览：
 *   第一部分：导入依赖与导航项类型
 *   第二部分：按角色生成平台与租户导航
 *   第三部分：导航组件与页面壳组件
 */
import Link from "next/link";
import type { Tenant, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

type NavItem = {
  label: string;
  href: string;
};

function buildPlatformNavItems(): NavItem[] {
  return [
    { label: "租户管理", href: "/admin" },
    { label: "平台审计日志", href: "/admin/audit-logs" },
    { label: "退出", href: "/logout" }
  ];
}

function buildTenantNavItems(tenant: Tenant, role: UserRole): NavItem[] {
  const base = `/app/${tenant.slug}`;

  if (role === "PLATFORM_ADMIN") {
    return [
      { label: "返回平台后台", href: "/admin" },
      { label: "平台审计日志", href: "/admin/audit-logs" },
      { label: "演示说明", href: `${base}/demo-guide` },
      { label: "退出", href: "/logout" }
    ];
  }

  if (role === "TENANT_ADMIN") {
    return [
      { label: "Dashboard", href: `${base}/dashboard` },
      { label: "客户列表", href: `${base}/leads` },
      { label: "客户导入", href: `${base}/imports` },
      { label: "业务线／产品", href: `${base}/business-lines` },
      { label: "销售工作台", href: `${base}/todos` },
      { label: "资料包", href: `${base}/materials` },
      { label: "策略库", href: `${base}/strategies` },
      { label: "任务模板", href: `${base}/task-templates` },
      { label: "审计日志", href: `${base}/audit-logs` },
      { label: "演示说明", href: `${base}/demo-guide` },
      { label: "客户导出", href: `${base}/export` },
      { label: "企业微信配置", href: `${base}/wecom` },
      { label: "退出", href: "/logout" }
    ];
  }

  if (role === "OPERATOR") {
    return [
      { label: "Dashboard", href: `${base}/dashboard` },
      { label: "客户列表", href: `${base}/leads` },
      { label: "客户导入", href: `${base}/imports` },
      { label: "业务线／产品", href: `${base}/business-lines` },
      { label: "销售工作台", href: `${base}/todos` },
      { label: "资料包", href: `${base}/materials` },
      { label: "策略库", href: `${base}/strategies` },
      { label: "任务模板", href: `${base}/task-templates` },
      { label: "演示说明", href: `${base}/demo-guide` },
      { label: "退出", href: "/logout" }
    ];
  }

  return [
    { label: "Dashboard", href: `${base}/dashboard` },
    { label: "我的客户", href: `${base}/leads` },
    { label: "销售工作台", href: `${base}/todos` },
    { label: "演示说明", href: `${base}/demo-guide` },
    { label: "退出", href: "/logout" }
  ];
}

function NavBar({ items }: { items: NavItem[] }) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-6 py-3">
      {items.map((item) => (
        <Link key={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

async function ShellNav({ tenant }: { tenant?: Tenant }) {
  const user = await getCurrentUser();
  if (!user) return null;

  if (tenant) {
    return <NavBar items={buildTenantNavItems(tenant, user.role)} />;
  }

  if (user.role === "PLATFORM_ADMIN") {
    return <NavBar items={buildPlatformNavItems()} />;
  }

  return null;
}

export async function PageShell({
  tenant,
  title,
  description,
  children
}: {
  tenant?: Tenant;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <ShellNav tenant={tenant} />
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
          {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
        </div>
        {children}
      </section>
    </main>
  );
}
