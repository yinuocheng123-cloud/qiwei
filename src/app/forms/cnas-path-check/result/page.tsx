/*
 * 文件说明：该文件实现 CNAS 认可路径判断问卷提交后的公开结果页。
 * 功能说明：按 A/B/C 结果展示初步判断、下一步建议和顾问跟进提示，不暴露后台详情。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：结果页渲染
 */
import Link from "next/link";
import { CNAS_SOURCE_PAGE, getCnasDiagnosisPresentation } from "@/lib/cnas";

export const dynamic = "force-dynamic";

export default function CnasPathCheckResultPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const diagnosis = typeof searchParams.diagnosis === "string" ? searchParams.diagnosis : undefined;
  const presentation = getCnasDiagnosisPresentation(diagnosis);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">提交成功</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">你的情况初步判断为：{presentation.title}</h1>
        <div className="mt-4 inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
          {presentation.badge}
        </div>
        <p className="mt-5 text-sm leading-7 text-slate-700">{presentation.summary}</p>
        <p className="mt-3 text-sm leading-7 text-slate-600">{presentation.nextAction}</p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
          <p>顾问会根据你提交的信息继续跟进。</p>
          <p>如果你已经通过企业微信承接客户，也可以继续在后续沟通中补充实验室类型、当前阶段和最担心的问题。</p>
          <p>当前问卷入口：{CNAS_SOURCE_PAGE}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={CNAS_SOURCE_PAGE}>
            返回问卷
          </Link>
        </div>
      </div>
    </main>
  );
}
