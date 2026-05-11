"use server";

/*
 * 文件说明：该文件实现登录 Server Action。
 * 功能说明：校验 bcrypt 密码、创建数据库 Session，并按角色跳转到对应后台。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：表单读取工具
 *   第三部分：登录动作
 */
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function loginAction(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const next = text(formData, "next");

  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true }
  });

  if (!user || user.status !== "active") {
    redirect("/login?error=invalid");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    redirect("/login?error=invalid");
  }

  await createSession(user.id);

  if (next && next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }

  if (user.role === "PLATFORM_ADMIN") {
    redirect("/admin");
  }

  if (user.tenant) {
    redirect(`/app/${user.tenant.slug}/dashboard`);
  }

  redirect("/login?error=no-tenant");
}
