/*
 * 文件说明：该文件实现后台路径的 middleware 基础安全拦截。
 * 功能说明：在进入页面前校验登录态提示 cookie，拦截未登录、非平台管理员和跨租户访问。
 *
 * 结构概览：
 *   第一部分：导入依赖与类型
 *   第二部分：Edge HMAC 校验工具
 *   第三部分：路径权限判断
 *   第四部分：middleware 导出配置
 */
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_CONTEXT_COOKIE_NAME } from "@/lib/auth-constants";

type AuthContext = {
  userId: string;
  role: "PLATFORM_ADMIN" | "TENANT_ADMIN" | "OPERATOR" | "SALES";
  tenantSlug: string | null;
  expiresAt: number;
};

function getSessionSecret() {
  return process.env.SESSION_SECRET || "development-only-session-secret";
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signPayload(payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(getSessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64Url(signature);
}

async function readAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const value = request.cookies.get(AUTH_CONTEXT_COOKIE_NAME)?.value;
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = await signPayload(payload);
  if (expected !== signature) return null;

  try {
    const context = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as AuthContext;
    if (!context.userId || !context.role || context.expiresAt <= Date.now()) return null;
    return context;
  } catch {
    return null;
  }
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const auth = await readAuthContext(request);

  if (!auth) {
    return redirectToLogin(request);
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (auth.role !== "PLATFORM_ADMIN") {
      return NextResponse.redirect(new URL("/forbidden", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/app/")) {
    const tenantSlug = pathname.split("/")[2];
    const isDemoGuide = pathname === `/app/${tenantSlug}/demo-guide`;
    if (auth.role === "PLATFORM_ADMIN" && isDemoGuide) {
      return NextResponse.next();
    }
    const tenantRole = auth.role === "TENANT_ADMIN" || auth.role === "OPERATOR" || auth.role === "SALES";
    if (!tenantRole || !tenantSlug || auth.tenantSlug !== tenantSlug) {
      return NextResponse.redirect(new URL("/forbidden", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/app/:path*"]
};
