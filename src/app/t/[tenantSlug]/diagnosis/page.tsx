/*
 * 文件说明：该文件实现公开诊断表单。
 * 功能说明：客户提交后创建 IntakeForm 与 Lead，并记录 URL source 参数。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：诊断表单页面
 */
import { FormType } from "@prisma/client";
import { submitIntakeForm } from "@/lib/actions";
import { customerTypeOptions, needTypeOptions, sourceOptions } from "@/lib/options";
import { getTenantBySlug } from "@/lib/tenant";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

export default async function DiagnosisPage({ params, searchParams }: { params: { tenantSlug: string }; searchParams: { source?: string } }) {
  const tenant = await getTenantBySlug(params.tenantSlug);
  const action = submitIntakeForm.bind(null, tenant.slug, FormType.diagnosis);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <p className="text-sm font-semibold text-emerald-700">{tenant.name}</p>
      <h1 className="mt-2 text-3xl font-bold">增长诊断表</h1>
      <p className="mt-2 text-sm text-slate-600">提交后系统会自动识别来源、客户类型和需求，并生成销售线索。</p>
      <Card className="mt-6">
        <form action={action} className="space-y-4">
          <input type="hidden" name="source" value={searchParams.source ?? "other"} />
          <Input label="姓名" name="name" required />
          <Input label="手机号" name="phone" required />
          <Input label="微信" name="wechat" />
          <Input label="公司" name="company" />
          <Input label="行业" name="industry" />
          <Input label="城市" name="city" />
          <Select label="客户类型" name="customerType" options={customerTypeOptions} defaultValue="FACTORY_CLIENT" />
          <Select label="需求类型" name="needType" options={needTypeOptions} defaultValue="GROWTH_SYSTEM" />
          <Select label="来源渠道" name="sourceVisible" options={sourceOptions} defaultValue={searchParams.source ?? "other"} />
          <Textarea label="当前想解决的问题" name="message" />
          <label className="flex items-center gap-2 text-sm">
            <input name="urgent" type="checkbox" />
            想尽快沟通
          </label>
          <SubmitButton>提交诊断</SubmitButton>
        </form>
      </Card>
    </main>
  );
}
