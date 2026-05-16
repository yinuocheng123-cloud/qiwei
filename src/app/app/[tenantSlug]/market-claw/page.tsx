/*
 * 文件说明：该文件实现 V2.0 麻虾助手模块入口页。
 * 功能说明：为不同角色提供麻虾知识库、训练场与回复记录的统一入口，避免访问 `/market-claw` 时落空。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：模块入口页
 */
import Link from "next/link";
import { PageShell } from "@/components/Shell";
import { Card } from "@/components/Ui";
import {
  canAccessMarketClawKnowledge,
  canAccessMarketClawReplies,
  canAccessMarketClawTraining,
  requireTenantAccess
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MarketClawPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);

  const sections = [
    canAccessMarketClawKnowledge(user.role)
      ? {
          title: "麻虾知识库",
          description: "把产品、FAQ、案例、价格边界和不能承诺事项沉淀成企业自己的销售知识。",
          href: `/app/${tenant.slug}/market-claw/knowledge`
        }
      : null,
    canAccessMarketClawTraining(user.role)
      ? {
          title: "回复训练场",
          description: "模拟客户问题，验证三版回复是否准确、像人话、有边界，并把可用结果沉淀成标准回复。",
          href: `/app/${tenant.slug}/market-claw/training`
        }
      : null,
    canAccessMarketClawReplies(user.role)
      ? {
          title: "回复记录",
          description: "回看已经生成、复制、保存为跟进或收到反馈的麻虾回复草稿。",
          href: `/app/${tenant.slug}/market-claw/replies`
        }
      : null
  ].filter((item): item is { title: string; description: string; href: string } => Boolean(item));

  return (
    <PageShell
      tenant={tenant}
      title="麻虾助手"
      description="把企业知识，训练成销售会用的话。当前版本不接企业微信上下文，不自动发送客户消息，只做知识投喂、训练、回复草稿和跟进建议闭环。"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.href}>
            <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{section.description}</p>
            <Link
              className="mt-5 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
              href={section.href}
            >
              进入
            </Link>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
