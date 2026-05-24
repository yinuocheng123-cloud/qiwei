/*
 * 文件说明：该文件实现企业项目后台的销售资料清单页面。
 * 功能说明：把资料页收口成“客户类型 + 状态 + 展开详情”的销售发送清单，避免默认呈现成 CMS 后台。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：资料分组与展示辅助
 *   第三部分：销售资料清单页面
 */
import type { CustomerType, UserRole } from "@prisma/client";
import { createMaterial, updateMaterial } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerTypeOptions } from "@/lib/options";
import { PageShell } from "@/components/Shell";
import { Card } from "@/components/Ui";
import {
  MaterialChecklistGroup,
  MaterialChecklistItem,
  MaterialCreatePanel,
  type MaterialChecklistRecord
} from "@/components/MaterialChecklist";

export const dynamic = "force-dynamic";

function buildMaterialGroups(materials: MaterialChecklistRecord[]) {
  const materialsByCustomerType = new Map<CustomerType | "GENERAL", MaterialChecklistRecord[]>();

  for (const material of materials) {
    const key = (material.customerType ?? "GENERAL") as CustomerType | "GENERAL";
    materialsByCustomerType.set(key, [...(materialsByCustomerType.get(key) ?? []), material]);
  }

  const customerTypeGroups = customerTypeOptions
    .filter((option) => materialsByCustomerType.has(option.value as CustomerType))
    .map((option) => ({
      key: option.value as CustomerType,
      title: `${option.label}资料清单`,
      description: `适合${option.label}场景的销售资料，销售先看清单，展开后再看链接和说明。`,
      materials: materialsByCustomerType.get(option.value as CustomerType) ?? []
    }));

  const generalMaterials = materialsByCustomerType.get("GENERAL") ?? [];
  const generalGroup =
    generalMaterials.length > 0
      ? [
          {
            key: "GENERAL" as const,
            title: "通用资料清单",
            description: "不绑定客户类型的通用销售资料，适合先发给客户快速确认。",
            materials: generalMaterials
          }
        ]
      : [];

  return [...customerTypeGroups, ...generalGroup];
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
    <PageShell
      tenant={tenant}
      title="销售资料清单"
      description="按客户类型整理销售可发送的资料。销售先看清单和状态，需要时再展开查看链接、描述和编辑项。"
    >
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
            <p className="mt-2 text-sm text-slate-500">
              当前还没有可发给客户的资料。建议先准备产品介绍、成功案例、服务流程、报价说明和常见问题链接。
            </p>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
