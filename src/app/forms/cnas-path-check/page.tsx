/*
 * 文件说明：该文件实现 CNAS 认可路径判断公开问卷页。
 * 功能说明：收集实验室类型、当前阶段、主要担心问题和 UTM 参数，并提交到现有增长中台生成线索与诊断。
 *
 * 结构概览：
 *   第一部分：导入依赖与页面常量
 *   第二部分：公开问卷页渲染
 */
import { submitCnasPathCheckForm } from "@/lib/actions";
import {
  CNAS_SOURCE_PAGE,
  cnasCurrentStageOptions,
  cnasLabTypeOptions,
  cnasPrimaryConcernOptions,
  cnasReadinessOptions,
  cnasScopeClarityOptions,
  cnasStartPlanOptions,
  cnasWeComAddedOptions
} from "@/lib/cnas";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

export default function CnasPathCheckPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pick = (key: string) => (typeof searchParams[key] === "string" ? (searchParams[key] as string) : "");

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <p className="text-sm font-semibold text-emerald-700">CNAS认可指南</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">CNAS认可路径判断问卷</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        这份问卷用于初步判断实验室当前是否适合启动 CNAS 认可，以及更适合先做路径设计、基础条件核对，还是先补齐人员、设备、体系文件和运行记录。
      </p>
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        <p>本问卷不会自动代替正式咨询结论。</p>
        <p>提交后，系统会根据实验室类型、当前阶段和主要担心问题生成初步判断，并由顾问继续跟进。</p>
      </div>

      <Card className="mt-6">
        <form action={submitCnasPathCheckForm} className="space-y-4">
          <input type="hidden" name="sourcePage" value={CNAS_SOURCE_PAGE} />
          <input type="hidden" name="source_channel" value={pick("source_channel") || "CNAS问卷"} />
          <input type="hidden" name="source_project" value={pick("source_project") || "CNAS认可指南"} />
          <input type="hidden" name="source_campaign" value={pick("source_campaign")} />
          <input type="hidden" name="source_scene" value={pick("source_scene")} />
          <input type="hidden" name="source_touchpoint" value={pick("source_touchpoint")} />
          <input type="hidden" name="source_qr" value={pick("source_qr")} />
          <input type="hidden" name="source_staff" value={pick("source_staff")} />
          <input type="hidden" name="source_page" value={pick("source_page") || CNAS_SOURCE_PAGE} />
          <input type="hidden" name="source_content" value={pick("source_content")} />
          <input type="hidden" name="utm_source" value={pick("utm_source")} />
          <input type="hidden" name="utm_medium" value={pick("utm_medium")} />
          <input type="hidden" name="utm_campaign" value={pick("utm_campaign")} />
          <input type="hidden" name="utm_content" value={pick("utm_content")} />
          <input type="hidden" name="utm_term" value={pick("utm_term")} />

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="企业名称" name="company" required />
            <Input label="联系人" name="contactName" required />
            <Input label="手机号" name="phone" required />
            <Select label="实验室类型" name="labType" options={cnasLabTypeOptions} defaultValue="检测实验室" />
            <Select label="当前阶段" name="currentStage" options={cnasCurrentStageOptions} defaultValue="刚开始了解" />
            <Select label="认可范围是否明确" name="scopeClarity" options={cnasScopeClarityOptions} defaultValue="还不清楚" />
            <Select label="人员设备是否基本具备" name="readiness" options={cnasReadinessOptions} defaultValue="不确定" />
            <Select label="计划启动时间" name="startPlan" options={cnasStartPlanOptions} defaultValue="只是先了解" />
            <Select label="最担心的问题" name="primaryConcern" options={cnasPrimaryConcernOptions} defaultValue="不知道从哪开始" />
            <Select label="是否已添加企业微信" name="wecomAdded" options={cnasWeComAddedOptions} defaultValue="否" />
          </div>

          <Textarea label="补充说明" name="note" rows={4} />

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            <p>导入不会自动发送消息。</p>
            <p>表单不会接入企业微信 API。</p>
            <p>提交完成后，客户会进入系统，由顾问根据诊断结果继续跟进。</p>
          </div>

          <SubmitButton>提交问卷并生成初步判断</SubmitButton>
        </form>
      </Card>
    </main>
  );
}
