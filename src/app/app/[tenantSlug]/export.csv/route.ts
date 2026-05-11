/*
 * 文件说明：该文件实现客户基础数据 CSV 导出接口。
 * 功能说明：按 tenantSlug 解析 tenantId 并强制过滤，只输出企业自己的客户基础字段。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：CSV 工具
 *   第三部分：GET 导出处理
 */
import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(_: Request, { params }: { params: { tenantSlug: string } }) {
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN"]);
  const leads = await prisma.lead.findMany({
    where: { tenantId: tenant.id },
    include: { owner: true },
    orderBy: { createdAt: "desc" }
  });

  const header = ["客户姓名", "手机号", "微信", "公司", "行业", "城市", "来源", "客户类型", "需求类型", "意向等级", "客户阶段", "成交状态", "负责人", "创建时间", "最后跟进时间", "备注摘要"];
  const rows = leads.map((lead) => [
    lead.name,
    lead.phone,
    lead.wechat,
    lead.company,
    lead.industry,
    lead.city,
    lead.source,
    lead.customerType,
    lead.needType,
    lead.intentionLevel,
    lead.stage,
    lead.dealStatus,
    lead.owner?.name,
    lead.createdAt,
    lead.lastFollowAt,
    lead.message
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${tenant.slug}-leads.csv"`
    }
  });
}
