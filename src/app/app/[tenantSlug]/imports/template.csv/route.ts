/*
 * 文件说明：该文件提供 V1.8 客户导入模板下载接口。
 * 功能说明：按当前租户权限输出通用 CSV 模板，帮助管理员和运营按标准字段准备导入文件。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：CSV 模板下载接口
 */
import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth";
import { importTemplateHeaders, importTemplateSampleRow } from "@/lib/imports";

export const dynamic = "force-dynamic";

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(_: Request, { params }: { params: { tenantSlug: string } }) {
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const rows = [importTemplateHeaders, importTemplateSampleRow];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${tenant.slug}-lead-import-template.csv"`
    }
  });
}
