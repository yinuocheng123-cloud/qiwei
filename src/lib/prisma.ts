/*
 * 文件说明：该文件提供 PrismaClient 单例。
 * 功能说明：在 Next.js 开发热更新场景复用数据库连接，避免重复创建连接。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：全局单例创建
 *   第三部分：导出 Prisma 客户端
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
