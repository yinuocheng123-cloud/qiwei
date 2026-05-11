/*
 * 文件说明：该文件实现企业微信配置预留页面。
 * 功能说明：保存企业微信对接所需字段，但 V1.0 不进行真实 API 调用。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：配置页面
 */
import { upsertWeComConfig } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, SubmitButton } from "@/components/Ui";

export const dynamic = "force-dynamic";

export default async function WeComPage({ params }: { params: { tenantSlug: string } }) {
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const config = await prisma.weComConfig.findUnique({ where: { tenantId: tenant.id } });
  const action = upsertWeComConfig.bind(null, tenant.slug);

  return (
    <PageShell tenant={tenant} title="企业微信配置预留" description="V1.0 仅保存配置结构，secret 字段按加密占位保存，页面不展示明文。">
      <Card className="max-w-2xl">
        <form action={action} className="space-y-4">
          <Input label="CorpId" name="corpId" defaultValue={config?.corpId ?? ""} />
          <Input label="AgentId" name="agentId" defaultValue={config?.agentId ?? ""} />
          <Input label="Secret 加密值占位" name="secretEncrypted" defaultValue={config?.secretEncrypted ? "******" : ""} />
          <Input label="Token" name="token" defaultValue={config?.token ?? ""} />
          <Input label="EncodingAESKey" name="encodingAESKey" defaultValue={config?.encodingAESKey ?? ""} />
          <Input label="CallbackUrl" name="callbackUrl" defaultValue={config?.callbackUrl ?? ""} />
          <Select
            label="状态"
            name="status"
            defaultValue={config?.status ?? "draft"}
            options={[
              { value: "draft", label: "draft" },
              { value: "enabled", label: "enabled" },
              { value: "disabled", label: "disabled" }
            ]}
          />
          <SubmitButton>保存配置</SubmitButton>
        </form>
      </Card>
    </PageShell>
  );
}
