/*
 * 文件说明：该文件提供后台通用页面壳。
 * 功能说明：统一企业后台导航和内容宽度，避免每个页面重复布局。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：企业后台导航组件
 *   第三部分：后台页面壳组件
 */
import Link from "next/link";
import type { Tenant } from "@prisma/client";

export function TenantNav({ tenant }: { tenant: Tenant }) {
  const base = `/app/${tenant.slug}`;
  const items = [
    ["看板", `${base}/dashboard`],
    ["演示说明", `${base}/demo-guide`],
    ["工作台", `${base}/todos`],
    ["客户线索", `${base}/leads`],
    ["策略库", `${base}/strategies`],
    ["资料包", `${base}/materials`],
    ["任务模板", `${base}/task-templates`],
    ["审计日志", `${base}/audit-logs`],
    ["企微配置", `${base}/wecom`],
    ["导出客户", `${base}/export`],
    ["退出", "/logout"]
  ];

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-6 py-3">
      {items.map(([label, href]) => (
        <Link key={href} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function PageShell({
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
      {tenant ? <TenantNav tenant={tenant} /> : null}
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
