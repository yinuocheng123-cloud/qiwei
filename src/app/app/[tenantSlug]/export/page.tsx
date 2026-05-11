/*
 * 文件说明：该文件实现客户基础数据导出入口。
 * 功能说明：明确导出边界，只允许导出客户基础数据，不导出策略库、模板、源码和数据库结构。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：导出入口页面
 */
import Link from "next/link";
import { requireTenantAccess } from "@/lib/auth";
import { PageShell } from "@/components/Shell";
import { Card } from "@/components/Ui";

export const dynamic = "force-dynamic";

export default async function ExportPage({ params }: { params: { tenantSlug: string } }) {
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN"]);

  return (
    <PageShell tenant={tenant} title="客户数据导出" description="仅导出本企业客户基础数据，不包含系统模板库、策略库底层逻辑、自动化规则、源码或数据库结构。">
      <Card className="max-w-2xl">
        <p className="text-sm leading-6 text-slate-700">
          导出字段包括客户姓名、手机号、微信、公司、行业、城市、来源、客户类型、需求类型、意向等级、客户阶段、成交状态、负责人、创建时间、最后跟进时间和备注摘要。
        </p>
        <Link className="mt-5 inline-block rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={`/app/${tenant.slug}/export.csv`}>
          下载 CSV
        </Link>
      </Card>
    </PageShell>
  );
}
