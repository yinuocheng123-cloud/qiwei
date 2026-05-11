/*
 * 文件说明：该文件实现无权限提示页。
 * 功能说明：当用户越权访问平台或其他租户后台时，统一展示拒绝信息。
 *
 * 结构概览：
 *   第一部分：无权限页面组件
 */
import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12 text-center">
      <p className="text-sm font-semibold text-red-700">访问被拒绝</p>
      <h1 className="mt-3 text-3xl font-bold">你没有权限访问这个页面</h1>
      <p className="mt-3 text-slate-600">请确认当前账号角色和所属企业租户是否匹配。</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href="/login">
          重新登录
        </Link>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" href="/logout">
          退出
        </Link>
      </div>
    </main>
  );
}
