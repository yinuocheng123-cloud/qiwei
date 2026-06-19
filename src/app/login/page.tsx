import { loginAction } from "@/lib/auth-actions";
import { Card, Input, SubmitButton } from "@/components/Ui";

export default function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  const errorText =
    searchParams.error === "invalid"
      ? "账号或密码不正确。"
      : searchParams.error === "no-tenant"
        ? "企业账号缺少租户绑定，请联系平台管理员。"
        : "";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-semibold text-emerald-700">MarketClaw 销售助手</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">登录</h1>
      <p className="mt-2 text-sm text-slate-600">使用平台账号进入对应工作台。</p>
      <Card className="mt-6">
        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={searchParams.next ?? ""} />
          <Input label="账号" name="email" required />
          <Input label="密码" name="password" type="password" required />
          {errorText ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorText}</p> : null}
          <SubmitButton>登录</SubmitButton>
        </form>
      </Card>
      <div className="mt-5 rounded-md bg-white p-4 text-sm leading-6 text-slate-600">
        <p>平台管理员：admin@growthhub.local / 123456</p>
        <p>企业管理员：boss@zhengmu.local / 123456</p>
        <p>运营人员：operator@zhengmu.local / 123456</p>
        <p>销售顾问：sales@zhengmu.local / 123456</p>
      </div>
    </main>
  );
}
