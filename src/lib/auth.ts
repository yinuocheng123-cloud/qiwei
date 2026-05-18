/*
 * 文件说明：该文件实现 V1.1 的轻量认证与 RBAC 工具。
 * 功能说明：使用数据库 Session 与 httpOnly cookie 管理登录态，并提供平台和租户权限校验。
 *
 * 结构概览：
 *   第一部分：导入依赖与常量
 *   第二部分：session token 创建、哈希和 cookie 管理
 *   第三部分：当前用户读取
 *   第四部分：RBAC 权限校验
 */
import crypto from "crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Tenant, User, UserRole } from "@prisma/client";
import { AUTH_CONTEXT_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { prisma } from "@/lib/prisma";

const SESSION_MAX_AGE_DAYS = 7;

type CurrentUser = User & {
  tenant: Tenant | null;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return secret || "development-only-session-secret";
}

function hashToken(token: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function createAuthContextCookieValue(input: { userId: string; role: UserRole; tenantSlug: string | null; expiresAt: Date }) {
  const payload = base64Url(
    JSON.stringify({
      userId: input.userId,
      role: input.role,
      tenantSlug: input.tenantSlug,
      expiresAt: input.expiresAt.getTime()
    })
  );
  const signature = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function createSession(input: { userId: string; role: UserRole; tenantSlug: string | null }) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash: hashToken(token),
      expiresAt
    }
  });

  cookies().set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
  cookies().set({
    name: AUTH_CONTEXT_COOKIE_NAME,
    value: createAuthContextCookieValue({ ...input, expiresAt }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function destroyCurrentSession() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) }
    });
  }
  cookies().delete(SESSION_COOKIE_NAME);
  cookies().delete(AUTH_CONTEXT_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { tenant: true } } }
  });

  if (!session || session.expiresAt <= new Date() || session.user.status !== "active") {
    if (session) {
      await prisma.session.deleteMany({ where: { id: session.id } });
    }
    cookies().delete(SESSION_COOKIE_NAME);
    cookies().delete(AUTH_CONTEXT_COOKIE_NAME);
    return null;
  }

  return session.user;
}

export async function requireUser(nextPath = "/") {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export async function requirePlatformAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "PLATFORM_ADMIN") {
    redirect("/forbidden");
  }
  return user;
}

export async function requireTenantAccess(tenantSlug: string, allowedRoles?: UserRole[]) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) notFound();

  const user = await requireUser(`/app/${tenantSlug}/dashboard`);
  if (!user.tenantId || user.tenantId !== tenant.id) {
    redirect("/forbidden");
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect("/forbidden");
  }

  return { user, tenant };
}

export async function requireDemoGuideAccess(tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) notFound();

  const user = await requireUser(`/app/${tenantSlug}/demo-guide`);
  if (user.role === "PLATFORM_ADMIN") {
    return { user, tenant };
  }

  if (!user.tenantId || user.tenantId !== tenant.id) {
    redirect("/forbidden");
  }

  if (!["TENANT_ADMIN", "OPERATOR", "SALES"].includes(user.role)) {
    redirect("/forbidden");
  }

  return { user, tenant };
}

export function canViewAllTenantLeads(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR";
}

export function canManageTenantGrowthContent(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR";
}

export function canAccessTenantBusinessLines(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR" || role === "SALES";
}

export function canManageTenantBusinessLines(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR";
}

export function canArchiveTenantBusinessLines(role: UserRole) {
  return role === "TENANT_ADMIN";
}

export function canAccessTenantAuditLogs(role: UserRole) {
  return role === "TENANT_ADMIN";
}

export function canAccessTenantWeCom(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR" || role === "SALES";
}

export function canManageTenantWeCom(role: UserRole) {
  return role === "TENANT_ADMIN";
}

export function canViewTenantWeComLogs(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR";
}

export function canExportTenantLeads(role: UserRole) {
  return role === "TENANT_ADMIN";
}

export function canImportTenantLeads(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR";
}

export function canAccessCommunicationCompliance(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR";
}

export function canManageCommunicationCompliance(role: UserRole) {
  return role === "TENANT_ADMIN";
}

export function canAccessMarketClawKnowledge(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR";
}

export function canAccessMarketClawTraining(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR" || role === "SALES";
}

export function canReviewMarketClawTraining(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR";
}

export function canAccessMarketClawReplies(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR" || role === "SALES";
}

export function canAccessMarketClawIngestion(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR";
}

export function canAccessMarketClawInsights(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR" || role === "SALES";
}

export function canAccessTenantOnboarding(role: UserRole) {
  return role === "TENANT_ADMIN" || role === "OPERATOR";
}

export async function requireLeadAccess(tenantSlug: string, leadId: string) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId: tenant.id }
  });

  if (!lead) notFound();
  if (user.role === "SALES" && lead.ownerId !== user.id) {
    redirect("/forbidden");
  }

  return { user, tenant, lead };
}
