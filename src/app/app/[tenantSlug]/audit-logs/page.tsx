/*
 * 文件说明：该文件实现租户内审计日志查询页面。
 * 功能说明：仅允许企业管理员查看本租户关键动作，避免敏感审计信息外泄。
 *
 * 结构概览：
 *   第一部分：导入依赖与筛选选项
 *   第二部分：metadata 摘要处理
 *   第三部分：租户审计日志页面
 */
import type { Prisma } from "@prisma/client";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select } from "@/components/Ui";
import { requireTenantAccess } from "@/lib/auth";
import { formatDate } from "@/lib/options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const actionOptions = [
  { value: "", label: "全部动作" },
  { value: "login_succeeded", label: "登录成功" },
  { value: "login_failed", label: "登录失败" },
  { value: "logout", label: "退出登录" },
  { value: "public_form_lead_created", label: "公开表单创建线索" },
  { value: "followup_created", label: "新增跟进" },
  { value: "lead_stage_updated", label: "更新客户阶段" },
  { value: "lead_owner_assigned", label: "分配负责人" },
  { value: "lead_csv_exported", label: "导出客户 CSV" },
  { value: "strategy_updated", label: "更新策略库" },
  { value: "material_created", label: "新增资料包" },
  { value: "material_updated", label: "更新资料包" },
  { value: "business_line_created", label: "新增业务线" },
  { value: "business_line_updated", label: "编辑业务线" },
  { value: "business_line_status_updated", label: "更新业务线状态" },
  { value: "reply_suggestion_generated", label: "生成建议回复" },
  { value: "reply_tag_suggested", label: "生成标签建议" },
  { value: "reply_tag_confirmed", label: "确认添加标签" },
  { value: "reply_suggestion_saved_as_followup", label: "建议回复保存为跟进" },
  { value: "task_created", label: "创建任务" },
  { value: "task_manual_created", label: "手动创建任务" },
  { value: "task_deduped_updated", label: "任务去重更新" },
  { value: "task_completed", label: "完成任务" },
  { value: "task_delayed", label: "延期任务" },
  { value: "task_cancelled", label: "取消任务" },
  { value: "task_template_created", label: "创建任务模板" },
  { value: "task_template_updated", label: "编辑任务模板" },
  { value: "task_template_deactivated", label: "停用任务模板" },
  { value: "task_template_used", label: "使用任务模板" },
  { value: "reminder_created", label: "创建提醒队列" },
  { value: "reminder_updated", label: "更新提醒队列" },
  { value: "reminder_cancelled", label: "取消提醒队列" },
  { value: "lead_bulk_assigned", label: "批量分配客户" },
  { value: "lead_bulk_stage_updated", label: "批量更新阶段" },
  { value: "lead_bulk_tag_added", label: "批量添加标签" },
  { value: "lead_bulk_next_follow_set", label: "批量设置下次跟进" },
  { value: "import_batch_created", label: "创建导入预览批次" },
  { value: "import_batch_completed", label: "完成客户导入" },
  { value: "import_batch_failed", label: "客户导入失败" }
];

const entityTypeOptions = [
  { value: "", label: "全部对象" },
  { value: "User", label: "用户" },
  { value: "Lead", label: "客户线索" },
  { value: "LeadTag", label: "客户标签" },
  { value: "FollowUp", label: "跟进记录" },
  { value: "ReplySuggestion", label: "建议回复" },
  { value: "FollowTask", label: "跟进任务" },
  { value: "TaskTemplate", label: "任务模板" },
  { value: "ReminderQueue", label: "提醒队列" },
  { value: "CustomerTypeStrategy", label: "客户策略" },
  { value: "Material", label: "资料包" },
  { value: "BusinessLine", label: "业务线" },
  { value: "ImportBatch", label: "导入批次" },
  { value: "ImportRow", label: "导入明细" },
  { value: "Tenant", label: "企业租户" }
];

function metadataSummary(value: Prisma.JsonValue | null) {
  if (!value) return "-";
  const text = JSON.stringify(value).replace(/secret|token|password/gi, "***");
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
}

export default async function AuditLogsPage({
  params,
  searchParams
}: {
  params: { tenantSlug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN"]);
  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }]
  });

  const action = typeof searchParams.action === "string" ? searchParams.action : "";
  const entityType = typeof searchParams.entityType === "string" ? searchParams.entityType : "";
  const userId = typeof searchParams.userId === "string" ? searchParams.userId : "";
  const start = typeof searchParams.start === "string" ? searchParams.start : "";
  const end = typeof searchParams.end === "string" ? searchParams.end : "";

  const where: Prisma.AuditLogWhereInput = {
    tenantId: tenant.id
  };
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (userId) where.userId = userId;
  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt.gte = new Date(start);
    if (end) where.createdAt.lte = new Date(end);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <PageShell
      tenant={tenant}
      title="审计日志"
      description="查看本企业关键业务动作和权限动作。"
    >
      <Card>
        <form className="grid gap-4 md:grid-cols-5">
          <Select label="动作" name="action" options={actionOptions} defaultValue={action} />
          <Select label="对象类型" name="entityType" options={entityTypeOptions} defaultValue={entityType} />
          <Select
            label="用户"
            name="userId"
            options={[{ value: "", label: "全部用户" }, ...users.map((item) => ({ value: item.id, label: `${item.name} / ${item.role}` }))]}
            defaultValue={userId}
          />
          <Input label="开始时间" name="start" type="datetime-local" defaultValue={start} />
          <Input label="结束时间" name="end" type="datetime-local" defaultValue={end} />
          <div className="flex items-end">
            <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">筛选</button>
          </div>
        </form>
      </Card>

      <Card className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">操作时间</th>
              <th className="px-3 py-2">用户</th>
              <th className="px-3 py-2">动作</th>
              <th className="px-3 py-2">对象类型</th>
              <th className="px-3 py-2">对象 ID</th>
              <th className="px-3 py-2">metadata 摘要</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-600">{formatDate(log.createdAt)}</td>
                <td className="px-3 py-2">{log.user?.name ?? "匿名/系统"}</td>
                <td className="px-3 py-2 font-medium">{log.action}</td>
                <td className="px-3 py-2">{log.entityType}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{log.entityId ?? "-"}</td>
                <td className="px-3 py-2 max-w-md break-words text-slate-600">{metadataSummary(log.metadata)}</td>
              </tr>
            ))}
            {!logs.length ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                  暂无审计日志。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
