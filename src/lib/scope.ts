/*
 * 文件说明：该文件提供 MarketClaw V3.0 企业 / 业务线上下文解析。
 * 功能说明：把 URL 查询参数、安全回退和数据库业务线解析收口到一处，供页面和动作共用。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：基础解析函数
 *   第三部分：页面作用域工具
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBusinessLineDefinition, getBusinessLinesForEnterprise, getEnterpriseDefinition, type MarketClawBusinessLineKey, type MarketClawEnterpriseKey } from "@/lib/marketclaw-context";

export function resolveScopeKeys(searchParams?: Record<string, string | undefined> | null) {
  const enterprise = getEnterpriseDefinition(searchParams?.enterpriseKey as MarketClawEnterpriseKey | undefined);
  const businessLine = getBusinessLineDefinition(enterprise.key, searchParams?.businessLineKey as MarketClawBusinessLineKey | undefined);

  return {
    enterpriseKey: enterprise.key,
    businessLineKey: businessLine.key,
    enterpriseDefinition: enterprise,
    businessLineDefinition: businessLine,
    businessLineOptions: getBusinessLinesForEnterprise(enterprise.key)
  };
}

export function buildScopeQuery(input: { enterpriseKey?: string | null; businessLineKey?: string | null }) {
  const params = new URLSearchParams();
  if (input.enterpriseKey) params.set("enterpriseKey", input.enterpriseKey);
  if (input.businessLineKey) params.set("businessLineKey", input.businessLineKey);
  return params.toString();
}

export function appendScopeToHref(href: string, input: { enterpriseKey?: string | null; businessLineKey?: string | null }) {
  const scopeQuery = buildScopeQuery(input);
  if (!scopeQuery) return href;

  const [hrefWithoutHash, hash = ""] = href.split("#");
  const [pathname, existingQuery = ""] = hrefWithoutHash.split("?");
  const params = new URLSearchParams(existingQuery);
  params.set("enterpriseKey", input.enterpriseKey ?? "");
  params.set("businessLineKey", input.businessLineKey ?? "");
  const query = params.toString();
  return `${pathname}?${query}${hash ? `#${hash}` : ""}`;
}

export async function resolveBusinessLineScope(tenantId: string, searchParams?: Record<string, string | undefined> | null) {
  const scope = resolveScopeKeys(searchParams);
  const businessLine = await prisma.businessLine.findFirst({
    where: {
      tenantId,
      key: scope.businessLineKey
    },
    include: {
      enterprise: true
    }
  });

  return {
    ...scope,
    businessLine,
    enterpriseId: businessLine?.enterpriseId ?? null,
    businessLineId: businessLine?.id ?? null
  };
}

export async function resolveBusinessLineScopeByKeys(input: {
  tenantId: string;
  enterpriseKey?: string | null;
  businessLineKey?: string | null;
}) {
  const scope = resolveScopeKeys({
    enterpriseKey: input.enterpriseKey ?? undefined,
    businessLineKey: input.businessLineKey ?? undefined
  });

  const businessLine = await prisma.businessLine.findFirst({
    where: {
      tenantId: input.tenantId,
      enterprise: { key: scope.enterpriseKey },
      key: scope.businessLineKey
    },
    include: {
      enterprise: true
    }
  });

  return {
    ...scope,
    businessLine,
    enterpriseId: businessLine?.enterpriseId ?? null,
    businessLineId: businessLine?.id ?? null
  };
}

export async function upsertScopedContact(input: {
  tenantId: string;
  enterpriseId: string;
  name: string;
  phone: string;
  company?: string | null;
  wechat?: string | null;
  city?: string | null;
  industry?: string | null;
  notes?: string | null;
}) {
  const normalizedPhone = input.phone.trim();
  const normalizedWechat = input.wechat?.trim() || null;
  const normalizedCompany = input.company?.trim() || null;

  const existing = await prisma.contact.findFirst({
    where: {
      tenantId: input.tenantId,
      enterpriseId: input.enterpriseId,
      OR: [
        { phone: normalizedPhone },
        ...(normalizedWechat ? [{ wechat: normalizedWechat }] : []),
        ...(normalizedCompany ? [{ name: input.name, company: normalizedCompany }] : [{ name: input.name }])
      ]
    }
  });

  const data: Prisma.ContactUncheckedCreateInput = {
    tenantId: input.tenantId,
    enterpriseId: input.enterpriseId,
    name: input.name,
    phone: normalizedPhone,
    company: normalizedCompany,
    wechat: normalizedWechat,
    city: input.city?.trim() || null,
    industry: input.industry?.trim() || null,
    notes: input.notes?.trim() || null
  };

  if (existing) {
    return prisma.contact.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        phone: normalizedPhone,
        company: normalizedCompany ?? existing.company,
        wechat: normalizedWechat ?? existing.wechat,
        city: input.city?.trim() || existing.city,
        industry: input.industry?.trim() || existing.industry,
        notes: input.notes?.trim() || existing.notes
      }
    });
  }

  return prisma.contact.create({ data });
}
