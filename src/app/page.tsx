import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold text-emerald-700">MarketClaw 销售助手</p>
      <h1 className="mt-3 text-4xl font-bold tracking-normal text-slate-950">客户跟进与销售协作工作台底座。</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700">
        当前版本聚焦客户、跟进、资料、下一步任务、工作台和管理员配置，AI 与企业微信仅作为可选连接能力预留。
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href="/admin">
          平台后台
        </Link>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" href="/login">
          登录
        </Link>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" href="/app/zhengmu-platform/dashboard">
          平台工作台
        </Link>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" href="/app/zhengmu-platform/demo-guide">
          平台说明
        </Link>
      </div>
    </main>
  );
}
