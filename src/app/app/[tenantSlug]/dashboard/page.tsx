/*
 * 文件说明：该文件实现企业数据看板页面。
 * 功能说明：展示新增客户、来源分布、客户类型分布、意向等级、阶段和重点跟进指标。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：看板页面组件
 */
import { PageShell } from "@/components/Shell";
import { DistributionTable, StatCard } from "@/components/Ui";
import { requireTenantAccess } from "@/lib/auth";
import { getDashboardMetrics } from "@/lib/dashboard";
import { customerTypeOptions, intentionOptions, labelOf, sourceOptions, stageOptions } from "@/lib/options";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const metrics = await getDashboardMetrics(tenant.id, user.role === "SALES" ? user.id : undefined);

  return (
    <PageShell tenant={tenant} title={`${tenant.name} 数据看板`} description="所有统计均基于当前企业 tenantId 过滤。">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="今日新增客户" value={metrics.todayCount} />
        <StatCard label="本周新增客户" value={metrics.weekCount} />
        <StatCard label="本月新增客户" value={metrics.monthCount} />
        <StatCard label="待跟进客户" value={metrics.pendingFollowCount} />
        <StatCard label="高意向客户" value={metrics.highIntentCount} />
        <StatCard label="已报价客户" value={metrics.quotedCount} />
        <StatCard label="已成交客户" value={metrics.wonCount} />
        <StatCard label="沉默客户" value={metrics.silentCount} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DistributionTable title="来源分布" rows={metrics.bySource.map((item) => ({ label: labelOf(sourceOptions, item.source), count: item._count }))} />
        <DistributionTable title="客户类型分布" rows={metrics.byCustomerType.map((item) => ({ label: labelOf(customerTypeOptions, item.customerType), count: item._count }))} />
        <DistributionTable title="意向等级分布" rows={metrics.byIntention.map((item) => ({ label: labelOf(intentionOptions, item.intentionLevel), count: item._count }))} />
        <DistributionTable title="阶段分布" rows={metrics.byStage.map((item) => ({ label: labelOf(stageOptions, item.stage), count: item._count }))} />
      </div>
    </PageShell>
  );
}
