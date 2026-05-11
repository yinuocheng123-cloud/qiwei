/*
 * 文件说明：该文件实现公开资料领取表单。
 * 功能说明：客户提交后创建 IntakeForm 与 Lead，默认需求为领取资料。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：资料领取页面
 */
import { FormType } from "@prisma/client";
import { submitIntakeForm } from "@/lib/actions";
import { customerTypeOptions, sourceOptions } from "@/lib/options";
import { getTenantBySlug } from "@/lib/tenant";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

export default async function MaterialPage({ params, searchParams }: { params: { tenantSlug: string }; searchParams: { source?: string } }) {
  const tenant = await getTenantBySlug(params.tenantSlug);
  const action = submitIntakeForm.bind(null, tenant.slug, FormType.material_request);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <p className="text-sm font-semibold text-emerald-700">{tenant.name}</p>
      <h1 className="mt-2 text-3xl font-bold">资料领取</h1>
      <p className="mt-2 text-sm text-slate-600">提交后销售会按您的客户类型发送对应资料和跟进建议。</p>
      <Card className="mt-6">
        <form action={action} className="space-y-4">
          <input type="hidden" name="source" value={searchParams.source ?? "other"} />
          <input type="hidden" name="needType" value="GET_MATERIAL" />
          <Input label="姓名" name="name" required />
          <Input label="手机号" name="phone" required />
          <Input label="微信" name="wechat" />
          <Input label="公司" name="company" />
          <Input label="城市" name="city" />
          <Select label="客户类型" name="customerType" options={customerTypeOptions} defaultValue="OWNER_CLIENT" />
          <Select label="来源渠道" name="sourceVisible" options={sourceOptions} defaultValue={searchParams.source ?? "other"} />
          <Textarea label="想领取什么资料" name="message" />
          <label className="flex items-center gap-2 text-sm">
            <input name="urgent" type="checkbox" />
            想尽快沟通
          </label>
          <SubmitButton>领取资料</SubmitButton>
        </form>
      </Card>
    </main>
  );
}
