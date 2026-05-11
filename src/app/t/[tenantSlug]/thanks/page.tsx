/*
 * 文件说明：该文件实现公开表单提交后的感谢页。
 * 功能说明：让客户确认提交成功，同时避免暴露后台细节。
 *
 * 结构概览：
 *   第一部分：感谢页组件
 */
export default function ThanksPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12 text-center">
      <p className="text-sm font-semibold text-emerald-700">提交成功</p>
      <h1 className="mt-3 text-3xl font-bold">我们已收到您的信息</h1>
      <p className="mt-3 text-slate-600">销售或顾问会根据您的来源、客户类型和需求安排后续沟通。</p>
    </main>
  );
}
