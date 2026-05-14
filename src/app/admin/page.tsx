/*
 * 文件说明：该文件实现平台总后台页面。
 * 功能说明：平台管理员可查看企业列表、创建企业、调整状态和进入企业项目后台。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：平台总后台页面
 */
import Link from "next/link";
import { createTenant, updateTenantStatus } from "@/lib/actions";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/options";
import { Card, Input, Select, SubmitButton } from "@/components/Ui";
import { PageShell } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requirePlatformAdmin();
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true, users: true } } }
  });

  return (
    <PageShell title="平台总后台" description="平台管理员视角：创建企业、维护租户状态，并从演示说明入口进入租户样板查看。">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-base font-semibold">新建企业</h2>
          <form action={createTenant} className="space-y-4">
            <Input label="企业名称" name="name" required />
            <Input label="项目 slug" name="slug" required />
            <Input label="行业" name="industry" />
            <Input label="到期时间" name="expiredAt" type="date" />
            <SubmitButton>创建企业</SubmitButton>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold">企业列表</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">企业</th>
                  <th className="px-3 py-2">行业</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">到期时间</th>
                  <th className="px-3 py-2">用户/线索</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-xs text-slate-500">{tenant.slug}</div>
                    </td>
                    <td className="px-3 py-3">{tenant.industry ?? "-"}</td>
                    <td className="px-3 py-3">{tenant.status}</td>
                    <td className="px-3 py-3">{formatDate(tenant.expiredAt)}</td>
                    <td className="px-3 py-3">
                      {tenant._count.users} / {tenant._count.leads}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link className="rounded-md border border-slate-300 px-3 py-1" href={`/app/${tenant.slug}/demo-guide`}>
                          查看演示说明
                        </Link>
                      </div>
                      <form action={updateTenantStatus} className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                        <input type="hidden" name="id" value={tenant.id} />
                        <Select
                          label="状态"
                          name="status"
                          defaultValue={tenant.status}
                          options={[
                            { value: "active", label: "active" },
                            { value: "paused", label: "paused" },
                            { value: "expired", label: "expired" }
                          ]}
                        />
                        <Input label="到期" name="expiredAt" type="date" defaultValue={tenant.expiredAt ? tenant.expiredAt.toISOString().slice(0, 10) : ""} />
                        <div className="pt-6">
                          <SubmitButton>更新</SubmitButton>
                        </div>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
