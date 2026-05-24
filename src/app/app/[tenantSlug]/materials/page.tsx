import type { UserRole } from "@prisma/client";
import { createMaterial, updateMaterial } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Card } from "@/components/Ui";
import {
  MaterialChecklistGroup,
  MaterialChecklistItem,
  MaterialCreatePanel,
  type MaterialChecklistRecord
} from "@/components/MaterialChecklist";

export const dynamic = "force-dynamic";

type MaterialBucketKey = "POTENTIAL" | "INTENTION" | "PARTNER" | "FOCUS" | "GENERAL";

function materialBucket(material: MaterialChecklistRecord): { key: MaterialBucketKey; label: string } {
  const type = material.customerType;
  switch (type) {
    case "OWNER_CLIENT":
      return { key: "POTENTIAL", label: "潜在客户" };
    case "DESIGNER_CLIENT":
    case "PLATFORM_GEO_AI_CLIENT":
    case "PLATFORM_TRAINING_CLIENT":
      return { key: "INTENTION", label: "意向客户" };
    case "DEALER_CLIENT":
    case "CHANNEL_PARTNER":
    case "PLATFORM_MEMBERSHIP_CLIENT":
    case "PLATFORM_EVENT_RESOURCE_CLIENT":
    case "PLATFORM_SUPPLY_CHAIN_CLIENT":
    case "PLATFORM_PARTNER_CLIENT":
      return { key: "PARTNER", label: "合作伙伴" };
    case "FACTORY_CLIENT":
    case "OLD_CLIENT":
    case "PLATFORM_FACTORY_OWNER":
    case "PLATFORM_AFTERMARKET_CLIENT":
      return { key: "FOCUS", label: "重点客户" };
    default:
      return { key: "GENERAL", label: "通用资料" };
  }
}

function buildMaterialGroups(materials: MaterialChecklistRecord[]) {
  const buckets = new Map<MaterialBucketKey, MaterialChecklistRecord[]>();

  for (const material of materials) {
    const bucket = materialBucket(material);
    buckets.set(bucket.key, [...(buckets.get(bucket.key) ?? []), material]);
  }

  const orderedBuckets: { key: MaterialBucketKey; label: string }[] = [
    { key: "POTENTIAL", label: "潜在客户" },
    { key: "INTENTION", label: "意向客户" },
    { key: "PARTNER", label: "合作伙伴" },
    { key: "FOCUS", label: "重点客户" },
    { key: "GENERAL", label: "通用资料" }
  ];

  return orderedBuckets
    .filter((bucket) => (buckets.get(bucket.key) ?? []).length > 0)
    .map((bucket) => ({
      key: bucket.key,
      title: `${bucket.label}资料清单`,
      description: `整理给${bucket.label}使用的销售资料，先看清单和状态，展开后再看链接与说明。`,
      materials: buckets.get(bucket.key) ?? []
    }));
}

export default async function MaterialsPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const canManage = (["TENANT_ADMIN", "OPERATOR"] as UserRole[]).includes(user.role);
  const materials = await prisma.material.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ customerType: "asc" }, { createdAt: "desc" }]
  });
  const groups = buildMaterialGroups(materials);
  const createAction = createMaterial.bind(null, tenant.slug);

  return (
    <PageShell tenant={tenant} title="销售资料清单" description="按客户类型整理可发送给客户的资料，先看清单和状态，必要时再展开编辑链接、描述和客户类型。">
      <div className="space-y-6">
        {canManage ? <MaterialCreatePanel action={createAction} /> : null}

        {groups.length ? (
          <div className="space-y-4">
            {groups.map((group) => (
              <MaterialChecklistGroup key={group.key} title={group.title} description={group.description} materials={group.materials}>
                {group.materials.map((material) => (
                  <MaterialChecklistItem
                    key={material.id}
                    material={material}
                    canManage={canManage}
                    editAction={canManage ? updateMaterial.bind(null, tenant.slug, material.id) : undefined}
                  />
                ))}
              </MaterialChecklistGroup>
            ))}
          </div>
        ) : (
          <Card>
            <h2 className="text-base font-semibold text-slate-950">销售资料清单</h2>
            <p className="mt-2 text-sm text-slate-500">当前还没有可发送给客户的资料。建议先准备产品介绍、成功案例、服务流程、报价说明和常见问题链接。</p>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
