/*
 * 文件说明：该文件实现企业微信配置预留页面。
 * 功能说明：保存企业微信对接所需字段，但 V1.0 不进行真实 API 调用，并避免在页面回显敏感配置。
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
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN"]);
  const config = await prisma.weComConfig.findUnique({ where: { tenantId: tenant.id } });
  const action = upsertWeComConfig.bind(null, tenant.slug);

  return (
    <PageShell tenant={tenant} title="企业微信配置预留" description="V1.0 仅保存配置结构，不展示 secret、token 和 EncodingAESKey 的历史明文。留空表示保持当前值。">
      <Card className="max-w-2xl">
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>当前状态：{config ? "已保存过配置" : "尚未保存配置"}</p>
          <p className="mt-1">敏感字段不会回显历史内容，如需更新请重新输入；如不修改请保持留空。</p>
        </div>
        <form action={action} className="space-y-4">
          <Input label="CorpId" name="corpId" defaultValue={config?.corpId ?? ""} />
          <Input label="AgentId" name="agentId" defaultValue={config?.agentId ?? ""} />
          <Input label="Secret 加密值占位" name="secretEncrypted" defaultValue="" />
          <Input label="Token" name="token" defaultValue="" />
          <Input label="EncodingAESKey" name="encodingAESKey" defaultValue="" />
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
