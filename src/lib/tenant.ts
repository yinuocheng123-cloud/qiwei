/*
 * 文件说明：该文件封装企业租户读取和隔离校验。
 * 功能说明：所有企业后台页面先通过 tenantSlug 获取 tenantId，再把 tenantId 传入后续查询。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：租户读取函数
 */
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function getTenantBySlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug }
  });

  if (!tenant) {
    notFound();
  }

  return tenant;
}

export async function getDefaultTenantUser(tenantId: string) {
  const sales = await prisma.user.findFirst({
    where: {
      tenantId,
      status: "active",
      role: "SALES"
    },
    orderBy: { createdAt: "asc" }
  });
  if (sales) return sales;

  return prisma.user.findFirst({
    where: {
      tenantId,
      status: "active",
      role: "TENANT_ADMIN"
    },
    orderBy: { createdAt: "asc" }
  });
}
