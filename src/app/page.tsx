/*
 * 文件说明：该文件实现项目首页。
 * 功能说明：提供 V1.0 主要入口，避免开发者首次打开时迷路。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：首页入口组件
 */
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold text-emerald-700">企业微信业务增长中台 V1.0</p>
      <h1 className="mt-3 text-4xl font-bold tracking-normal text-slate-950">客户从网上来，企业微信接得住，销售跟得上，老板看得清。</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700">
        当前版本聚焦多租户线索承接、客户类型策略库、销售跟进、资料领取、诊断表单和基础老板看板。
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href="/admin">
          平台总后台
        </Link>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" href="/login">
          登录
        </Link>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" href="/app/zhengmu-demo/dashboard">
          示例企业后台
        </Link>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" href="/t/zhengmu-demo/diagnosis?source=douyin">
          诊断表单
        </Link>
      </div>
    </main>
  );
}
