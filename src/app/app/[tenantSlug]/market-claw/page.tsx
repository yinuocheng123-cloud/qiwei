/*
 * 文件说明：该页面实现 V2.0.3 的 Market Claw 总览页。
 * 功能说明：为不同角色提供 Market Claw 入口、统计和最近使用记录，不再让 `/market-claw` 成为空跳转。
 *
 * 结构概览：
 *   第一部分：总览卡片组件
 *   第二部分：角色化快捷入口
 *   第三部分：Market Claw 总览页
 */
import Link from "next/link";
import { PageShell } from "@/components/Shell";
import { Card, StatCard } from "@/components/Ui";
import {
  canAccessMarketClawKnowledge,
  canAccessMarketClawReplies,
  canAccessMarketClawTraining,
  requireTenantAccess
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function EntryCard({
  title,
  description,
  href
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Card className="h-full">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <Link className="mt-4 inline-flex rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white" href={href}>
        进入
      </Link>
    </Card>
  );
}

export default async function MarketClawPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);

  const [knowledgeCount, trainingCount, replyDraftCount, feedbackCount, recentDrafts] = await Promise.all([
    canAccessMarketClawKnowledge(user.role)
      ? prisma.marketClawKnowledgeItem.count({ where: { tenantId: tenant.id } })
      : Promise.resolve(0),
    canAccessMarketClawTraining(user.role)
      ? prisma.marketClawTrainingCase.count({ where: { tenantId: tenant.id } })
      : Promise.resolve(0),
    prisma.marketClawReplyDraft.count({
      where: {
        tenantId: tenant.id,
        ...(user.role === "SALES" ? { createdById: user.id } : {})
      }
    }),
    canAccessMarketClawKnowledge(user.role)
      ? prisma.marketClawReplyFeedback.count({ where: { tenantId: tenant.id } })
      : Promise.resolve(0),
    prisma.marketClawReplyDraft.findMany({
      where: {
        tenantId: tenant.id,
        ...(user.role === "SALES" ? { createdById: user.id } : {})
      },
      select: {
        id: true,
        customerQuestion: true,
        createdAt: true,
        feedbackStatus: true,
        lead: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 6
    })
  ]);

  const roleCards =
    user.role === "SALES"
      ? [
          {
            title: "我的回复记录",
            description: "回看自己已经生成、复制或保存为跟进的回复草稿，继续复盘常见问题。",
            href: `/app/${tenant.slug}/market-claw/replies`
          },
          {
            title: "去客户列表",
            description: "销售继续从客户详情页使用 Market Claw 生成回复，不把知识库和训练场暴露成后台入口。",
            href: `/app/${tenant.slug}/leads`
          }
        ]
      : [
          {
            title: "知识库",
            description: "把产品、FAQ、案例、价格边界和不能承诺事项沉淀成可复用知识。",
            href: `/app/${tenant.slug}/market-claw/knowledge`
          },
          {
            title: "回复训练场",
            description: "模拟客户问题，验证回复是否准确、像人话且有边界，再沉淀为标准话术。",
            href: `/app/${tenant.slug}/market-claw/training`
          },
          {
            title: "回复记录",
            description: "回看销售实际使用情况，判断哪些回复、知识和边界仍需继续优化。",
            href: `/app/${tenant.slug}/market-claw/replies`
          },
          {
            title: "使用反馈",
            description: "结合反馈数量和最近使用记录，持续优化知识投喂与训练质量。",
            href: `/app/${tenant.slug}/market-claw/replies`
          }
        ];

  return (
    <PageShell
      tenant={tenant}
      title="Market Claw"
      description="把企业知识训练成销售会用的话。当前版本不接企业微信上下文，不自动发送客户消息，只做知识投喂、回复训练、回复草稿和跟进建议闭环。"
    >
      <Card className="bg-slate-950 text-white">
        <h2 className="text-xl font-semibold">Market Claw 总览</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
          它不是自动客服，而是销售侧的回复辅助模块。运营和管理员维护知识与训练，销售在客户详情页里实际使用，所有输出仍由人工确认。
        </p>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="知识库数量" value={knowledgeCount} />
        <StatCard label="训练样本数量" value={trainingCount} />
        <StatCard label="回复草稿数量" value={replyDraftCount} />
        <StatCard label="使用反馈数量" value={feedbackCount} />
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-950">快捷入口</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">不同角色看到的入口不同，销售看到的是工作入口，运营和管理员看到的是维护入口。</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roleCards.map((card) => (
            <EntryCard key={card.title} title={card.title} description={card.description} href={card.href} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-950">最近使用记录</h2>
        <div className="mt-4 space-y-3">
          {recentDrafts.length ? (
            recentDrafts.map((draft) => (
              <Card key={draft.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{draft.lead.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{draft.customerQuestion}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(draft.createdAt))}</p>
                    <p className="mt-1">反馈状态：{draft.feedbackStatus}</p>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm text-slate-500">
                {user.role === "SALES" ? "你还没有使用过 Market Claw，先去客户详情页生成一轮回复草稿。" : "当前还没有 Market Claw 使用记录。"}
              </p>
            </Card>
          )}
        </div>
      </section>
    </PageShell>
  );
}
