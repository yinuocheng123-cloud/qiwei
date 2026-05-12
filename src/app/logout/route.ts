/*
 * 文件说明：该文件实现退出登录路由。
 * 功能说明：删除当前数据库 Session，清除 httpOnly cookie，并返回登录页。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：GET 退出处理
 */
import { redirect } from "next/navigation";
import { safeWriteAuditLog } from "@/lib/audit";
import { destroyCurrentSession, getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (user) {
    await safeWriteAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: "logout",
      entityType: "User",
      entityId: user.id,
      metadata: { role: user.role, tenantSlug: user.tenant?.slug ?? null }
    });
  }
  await destroyCurrentSession();
  redirect("/login");
}
