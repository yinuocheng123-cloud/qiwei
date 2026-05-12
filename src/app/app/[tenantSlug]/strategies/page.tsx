/*
 * 文件说明：该文件实现客户类型策略库页面。
 * 功能说明：企业管理员和运营可编辑策略，销售可只读查看策略和绑定资料包。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：策略库页面
 *   第三部分：只读策略展示
 */
import { updateStrategy } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerTypeOptions, labelOf } from "@/lib/options";
import { PageShell } from "@/components/Shell";
import { Card, Input, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

export default async function StrategiesPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const canEdit = user.role === "TENANT_ADMIN" || user.role === "OPERATOR";
  const [strategies, materials] = await Promise.all([
    prisma.customerTypeStrategy.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" }
    }),
    prisma.material.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <PageShell tenant={tenant} title="客户类型策略库" description={canEdit ? "可编辑不同客户类型的资料、话术和推荐动作。" : "销售只读查看策略，用于跟进客户时参考。"}>
      <div className="grid gap-5 lg:grid-cols-2">
        {strategies.map((strategy) => {
          const boundMaterials = materials.filter((material) => material.customerType === strategy.customerType);
          const action = updateStrategy.bind(null, tenant.slug, strategy.id);
          return (
            <Card key={strategy.id}>
              <div className="mb-4">
                <p className="text-sm text-emerald-700">{labelOf(customerTypeOptions, strategy.customerType)}</p>
                <h2 className="text-lg font-semibold">{strategy.name}</h2>
              </div>
              {canEdit ? (
                <form action={action} className="space-y-4">
                  <Input label="策略名称" name="name" defaultValue={strategy.name} />
                  <Textarea label="客户关心点（换行或逗号分隔）" name="painPoints" defaultValue={strategy.painPoints.join("\n")} />
                  <Textarea label="首发资料（换行或逗号分隔）" name="firstMaterials" defaultValue={strategy.firstMaterials.join("\n")} />
                  <Textarea label="欢迎语" name="welcomeScript" defaultValue={strategy.welcomeScript} />
                  <Textarea label="3 天跟进话术" name="day3Script" defaultValue={strategy.day3Script} />
                  <Textarea label="7 天跟进话术" name="day7Script" defaultValue={strategy.day7Script} />
                  <Textarea label="15 天激活话术" name="day15Script" defaultValue={strategy.day15Script} />
                  <Textarea label="人工介入条件（换行或逗号分隔）" name="manualTriggerRules" defaultValue={strategy.manualTriggerRules.join("\n")} />
                  <Input label="推荐下一步动作" name="recommendedNextAction" defaultValue={strategy.recommendedNextAction} />
                  <Textarea label="推荐私域内容" name="recommendedPrivateContent" defaultValue={strategy.recommendedPrivateContent} />
                  <BoundMaterials materials={boundMaterials} />
                  <SubmitButton>保存策略</SubmitButton>
                </form>
              ) : (
                <div className="space-y-3 text-sm">
                  <ReadOnly label="客户关心点" value={strategy.painPoints.join("、")} />
                  <ReadOnly label="首发资料" value={strategy.firstMaterials.join("、")} />
                  <ReadOnly label="欢迎语" value={strategy.welcomeScript} />
                  <ReadOnly label="3 天跟进话术" value={strategy.day3Script} />
                  <ReadOnly label="7 天跟进话术" value={strategy.day7Script} />
                  <ReadOnly label="15 天激活话术" value={strategy.day15Script} />
                  <ReadOnly label="人工介入条件" value={strategy.manualTriggerRules.join("、")} />
                  <ReadOnly label="推荐下一步动作" value={strategy.recommendedNextAction} />
                  <ReadOnly label="推荐私域内容" value={strategy.recommendedPrivateContent} />
                  <BoundMaterials materials={boundMaterials} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-slate-950">{label}</p>
      <p className="mt-1 leading-6 text-slate-700">{value || "-"}</p>
    </div>
  );
}

function BoundMaterials({ materials }: { materials: { id: string; title: string; url: string }[] }) {
  return (
    <div>
      <p className="font-medium text-slate-950">已绑定资料包</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {materials.length ? (
          materials.map((material) => (
            <a key={material.id} className="rounded-md bg-emerald-50 px-3 py-1 text-sm text-emerald-800" href={material.url} target="_blank">
              {material.title}
            </a>
          ))
        ) : (
          <span className="text-sm text-slate-500">暂无绑定资料</span>
        )}
      </div>
    </div>
  );
}
