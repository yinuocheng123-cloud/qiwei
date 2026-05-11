/*
 * 文件说明：该文件实现客户类型策略库页面。
 * 功能说明：运营人员可查看并编辑不同客户类型的关心点、首发资料、话术和推荐动作。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：策略库页面
 */
import { updateStrategy } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerTypeOptions, labelOf } from "@/lib/options";
import { PageShell } from "@/components/Shell";
import { Card, Input, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

export default async function StrategiesPage({ params }: { params: { tenantSlug: string } }) {
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const strategies = await prisma.customerTypeStrategy.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "asc" }
  });

  return (
    <PageShell tenant={tenant} title="客户类型策略库" description="不同客户类型匹配不同欢迎语、资料、跟进节奏和成交动作。">
      <div className="grid gap-5 lg:grid-cols-2">
        {strategies.map((strategy) => {
          const action = updateStrategy.bind(null, tenant.slug, strategy.id);
          return (
            <Card key={strategy.id}>
              <div className="mb-4">
                <p className="text-sm text-emerald-700">{labelOf(customerTypeOptions, strategy.customerType)}</p>
                <h2 className="text-lg font-semibold">{strategy.name}</h2>
              </div>
              <form action={action} className="space-y-4">
                <Input label="策略名称" name="name" defaultValue={strategy.name} />
                <Textarea label="客户关心点（换行或逗号分隔）" name="painPoints" defaultValue={strategy.painPoints.join("\n")} />
                <Textarea label="首发资料（换行或逗号分隔）" name="firstMaterials" defaultValue={strategy.firstMaterials.join("\n")} />
                <Textarea label="欢迎语" name="welcomeScript" defaultValue={strategy.welcomeScript} />
                <Textarea label="3天跟进话术" name="day3Script" defaultValue={strategy.day3Script} />
                <Textarea label="7天跟进话术" name="day7Script" defaultValue={strategy.day7Script} />
                <Textarea label="15天激活话术" name="day15Script" defaultValue={strategy.day15Script} />
                <Textarea label="人工介入条件（换行或逗号分隔）" name="manualTriggerRules" defaultValue={strategy.manualTriggerRules.join("\n")} />
                <Input label="推荐下一步动作" name="recommendedNextAction" defaultValue={strategy.recommendedNextAction} />
                <Textarea label="推荐私域内容" name="recommendedPrivateContent" defaultValue={strategy.recommendedPrivateContent} />
                <SubmitButton>保存策略</SubmitButton>
              </form>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
