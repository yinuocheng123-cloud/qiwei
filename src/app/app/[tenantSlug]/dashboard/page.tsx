/*
 * 文件说明：该文件实现企业数据看板页面。
 * 功能说明：展示新增客户、待办提醒、来源分布、阶段分布和销售跟进概览。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：看板页面组件
 */
import { PageShell } from "@/components/Shell";
import { Card, DistributionTable, StatCard } from "@/components/Ui";
import { requireTenantAccess } from "@/lib/auth";
import { getDashboardMetrics } from "@/lib/dashboard";
import { customerTypeOptions, intentionOptions, labelOf, sourceOptions, stageOptions } from "@/lib/options";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const metrics = await getDashboardMetrics(tenant.id, user.role === "SALES" ? user.id : undefined);

  return (
    <PageShell tenant={tenant} title={`${tenant.name} 数据看板`} description="看板统计基于当前企业 tenantId；销售视角自动限制到本人负责客户。">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="今日新增客户" value={metrics.todayCount} />
        <StatCard label="本周新增客户" value={metrics.weekCount} />
        <StatCard label="本月新增客户" value={metrics.monthCount} />
        <StatCard label="今日待跟进" value={metrics.todayFollowCount} />
        <StatCard label="超时未跟进" value={metrics.overdueFollowCount} />
        <StatCard label="今日任务" value={metrics.taskTodayCount} />
        <StatCard label="逾期任务" value={metrics.taskOverdueCount} />
        <StatCard label="高优先级任务" value={metrics.taskHighPriorityCount} />
        <StatCard label="高意向客户" value={metrics.highIntentCount} />
        <StatCard label="未分配客户" value={metrics.unassignedCount} />
        <StatCard label="待激活客户" value={metrics.reactivateCount} />
        <StatCard label="已成交客户" value={metrics.wonCount} />
        <StatCard label="沉默客户" value={metrics.silentCount} />
      </div>

      {metrics.salesOverview.length ? (
        <Card className="mt-6">
          <h2 className="mb-4 text-base font-semibold text-slate-950">销售跟进概览</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">成员</th>
                  <th className="px-3 py-2">角色</th>
                  <th className="px-3 py-2">负责客户</th>
                  <th className="px-3 py-2">今日待跟进</th>
                  <th className="px-3 py-2">超时未跟进</th>
                  <th className="px-3 py-2">今日任务</th>
                  <th className="px-3 py-2">逾期任务</th>
                  <th className="px-3 py-2">已完成任务</th>
                  <th className="px-3 py-2">高意向客户</th>
                  <th className="px-3 py-2">报价客户</th>
                  <th className="px-3 py-2">已成交</th>
                </tr>
              </thead>
              <tbody>
                {metrics.salesOverview.map((row) => (
                  <tr key={row.userId} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-medium">{row.name}</td>
                    <td className="px-3 py-3">{row.role}</td>
                    <td className="px-3 py-3">{row.leadCount}</td>
                    <td className="px-3 py-3">{row.todayFollowCount}</td>
                    <td className="px-3 py-3">{row.overdueFollowCount}</td>
                    <td className="px-3 py-3">{row.todayTaskCount}</td>
                    <td className="px-3 py-3">{row.overdueTaskCount}</td>
                    <td className="px-3 py-3">{row.doneTaskCount}</td>
                    <td className="px-3 py-3">{row.highIntentCount}</td>
                    <td className="px-3 py-3">{row.quotedCount}</td>
                    <td className="px-3 py-3">{row.wonCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DistributionTable title="来源分布" rows={metrics.bySource.map((item) => ({ label: labelOf(sourceOptions, item.source), count: item._count }))} />
        <DistributionTable title="客户类型分布" rows={metrics.byCustomerType.map((item) => ({ label: labelOf(customerTypeOptions, item.customerType), count: item._count }))} />
        <DistributionTable title="意向等级分布" rows={metrics.byIntention.map((item) => ({ label: labelOf(intentionOptions, item.intentionLevel), count: item._count }))} />
        <DistributionTable title="阶段分布" rows={metrics.byStage.map((item) => ({ label: labelOf(stageOptions, item.stage), count: item._count }))} />
      </div>
    </PageShell>
  );
}
