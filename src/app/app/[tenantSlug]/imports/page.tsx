/*
 * 文件说明：该文件实现 V1.8 客户导入页面。
 * 功能说明：支持 CSV 上传预览、字段映射调整、默认负责人/标签/业务线设置、确认导入和导入记录查看。
 *
 * 结构概览：
 *   第一部分：导入依赖与展示辅助函数
 *   第二部分：导入页面子组件
 *   第三部分：客户导入页面
 */
import Link from "next/link";
import { ImportBatchStatus, ImportRowStatus } from "@prisma/client";
import { completeLeadImportBatch, previewLeadImportBatch, refreshLeadImportBatchPreview } from "@/lib/actions";
import { requireTenantAccess } from "@/lib/auth";
import {
  importFieldDefinitions,
  importTemplateHeaders,
  parseImportBatchMapping,
  parseImportDefaultSettings,
  type ImportPreviewRow
} from "@/lib/imports";
import { customerTypeOptions, formatDate, intentionOptions, labelOf, sourceOptions, stageOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/Shell";
import { Card, Input, Select, SubmitButton, Textarea } from "@/components/Ui";

export const dynamic = "force-dynamic";

function statusBadge(status: ImportBatchStatus | ImportRowStatus) {
  switch (status) {
    case "COMPLETED":
    case "IMPORTED":
      return "bg-emerald-50 text-emerald-700";
    case "FAILED":
      return "bg-red-50 text-red-700";
    case "DUPLICATE":
    case "SKIPPED":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function summarizeRowStatus(status: ImportRowStatus) {
  switch (status) {
    case "PENDING":
      return "待导入";
    case "FAILED":
      return "失败";
    case "DUPLICATE":
      return "疑似重复";
    case "SKIPPED":
      return "已跳过";
    case "IMPORTED":
      return "已导入";
    default:
      return status;
  }
}

function parsePreviewRows(rows: Awaited<ReturnType<typeof prisma.importRow.findMany>>): ImportPreviewRow[] {
  return rows.map((row) => {
    const normalizedData =
      row.normalizedData && typeof row.normalizedData === "object" && !Array.isArray(row.normalizedData)
        ? (row.normalizedData as ImportPreviewRow["normalizedData"])
        : null;
    const rawData =
      row.rawData && typeof row.rawData === "object" && !Array.isArray(row.rawData)
        ? Object.fromEntries(
            Object.entries(row.rawData as Record<string, unknown>).map(([key, value]) => [key, typeof value === "string" ? value : String(value ?? "")])
          )
        : {};

    return {
      rowIndex: row.rowIndex,
      rawData,
      normalizedData,
      status: row.status,
      errorMessage: row.errorMessage,
      duplicateLeadId: row.duplicateLeadId
    } satisfies ImportPreviewRow;
  });
}

function ImportTips() {
  return (
    <Card className="mb-6">
      <h2 className="text-base font-semibold text-slate-950">使用说明</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        把已有客户、活动名单、表单线索或历史客户导入系统，统一进入客户跟进、标签、业务线和任务管理。
      </p>
      <ul className="mt-3 space-y-1 text-sm text-slate-600">
        <li>导入不会自动发送消息。</li>
        <li>导入不会接入企业微信。</li>
        <li>导入不会自动替销售跟进。</li>
        <li>导入完成后，客户会进入系统，由负责人按任务继续跟进。</li>
      </ul>
    </Card>
  );
}

function UploadSection({ tenantSlug }: { tenantSlug: string }) {
  const previewAction = previewLeadImportBatch.bind(null, tenantSlug);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">上传并预览导入文件</h2>
          <p className="mt-1 text-sm text-slate-600">优先支持 CSV。上传后系统会先做字段映射、重复识别和失败原因预览。</p>
        </div>
        <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" href={`/app/${tenantSlug}/imports/template.csv`}>
          下载导入模板
        </Link>
      </div>
      <form action={previewAction} className="mt-4 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          选择 CSV 文件
          <input className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="csvFile" type="file" accept=".csv,text/csv" />
        </label>
        <Textarea
          label="或直接粘贴 CSV 内容"
          name="csvText"
          rows={8}
          defaultValue={[importTemplateHeaders.join(","), new Array(importTemplateHeaders.length).fill("").join(",")].join("\n")}
        />
        <p className="text-xs text-slate-500">如同时提供文件和文本，将优先读取文本内容，方便直接做 Playwright 和本地调试。</p>
        <SubmitButton>解析并生成预览</SubmitButton>
      </form>
    </Card>
  );
}

function PreviewSection({
  tenantSlug,
  batch,
  rows,
  owners,
  businessLines
}: {
  tenantSlug: string;
  batch: Awaited<ReturnType<typeof prisma.importBatch.findFirstOrThrow>>;
  rows: ImportPreviewRow[];
  owners: { id: string; name: string; email: string; role: string }[];
  businessLines: { id: string; name: string }[];
}) {
  const mapping = parseImportBatchMapping(batch.mapping);
  const defaults = parseImportDefaultSettings(batch);
  const refreshAction = refreshLeadImportBatchPreview.bind(null, tenantSlug);
  const completeAction = completeLeadImportBatch.bind(null, tenantSlug);

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">导入预览</h2>
          <p className="mt-1 text-sm text-slate-600">
            当前批次：{batch.fileName}，共 {batch.totalRows} 行，待导入 {batch.successRows} 行，失败 {batch.failedRows} 行，重复 {batch.duplicateRows} 行。
          </p>
        </div>
        <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${statusBadge(batch.status)}`}>{batch.status}</span>
      </div>

      <form action={refreshAction} className="space-y-4 rounded-md border border-slate-200 p-4">
        <input name="batchId" type="hidden" value={batch.id} />
        <div>
          <h3 className="text-sm font-semibold text-slate-950">字段映射</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {importFieldDefinitions.map((field) => (
              <Select
                key={field.key}
                label={field.label}
                name={`mapping_${field.key}`}
                defaultValue={mapping.fieldMapping[field.key] ?? ""}
                options={[
                  { value: "", label: "不映射" },
                  ...mapping.headers.map((header) => ({ value: header, label: header }))
                ]}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">导入设置</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Select
              label="默认负责人"
              name="defaultOwnerId"
              defaultValue={defaults.defaultOwnerId ?? ""}
              options={[
                { value: "", label: "不指定" },
                ...owners.map((owner) => ({ value: owner.id, label: `${owner.name} / ${owner.email}` }))
              ]}
            />
            <Input label="默认标签" name="defaultTags" defaultValue={defaults.defaultTags.join("，")} />
          </div>
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700">默认业务线</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {businessLines.map((businessLine) => (
                <label key={businessLine.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input defaultChecked={defaults.defaultBusinessLineIds.includes(businessLine.id)} name="defaultBusinessLineIds" type="checkbox" value={businessLine.id} />
                  <span>{businessLine.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input defaultChecked={defaults.autoCreateFirstTask} name="autoCreateFirstTask" type="checkbox" />
              <span>导入后自动生成首次跟进任务</span>
            </label>
            <label className="flex items-center gap-2">
              <input defaultChecked={defaults.skipDuplicates} name="skipDuplicates" type="checkbox" />
              <span>重复客户默认跳过</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <SubmitButton>更新预览结果</SubmitButton>
        </div>
      </form>

      <form action={completeAction} className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <input name="batchId" type="hidden" value={batch.id} />
        <p className="text-sm text-emerald-800">
          确认导入后，系统会写入客户、标签、导入记录，并按设置生成首次跟进任务；重复客户默认不覆盖原有资料。
        </p>
        <div className="mt-3">
          <SubmitButton>确认导入</SubmitButton>
        </div>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-slate-950">预览明细</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">行号</th>
                <th className="px-3 py-2">客户姓名</th>
                <th className="px-3 py-2">手机号</th>
                <th className="px-3 py-2">微信号</th>
                <th className="px-3 py-2">公司</th>
                <th className="px-3 py-2">客户类型</th>
                <th className="px-3 py-2">来源</th>
                <th className="px-3 py-2">意向等级</th>
                <th className="px-3 py-2">阶段</th>
                <th className="px-3 py-2">负责人</th>
                <th className="px-3 py-2">业务线</th>
                <th className="px-3 py-2">标签</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">错误原因</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const data = row.normalizedData;
                return (
                  <tr key={row.rowIndex} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.rowIndex}</td>
                    <td className="px-3 py-2">{data?.name || row.rawData["客户姓名"] || "-"}</td>
                    <td className="px-3 py-2">{data?.phone || "-"}</td>
                    <td className="px-3 py-2">{data?.wechat || "-"}</td>
                    <td className="px-3 py-2">{data?.company || "-"}</td>
                    <td className="px-3 py-2">{data ? labelOf(customerTypeOptions, data.customerType) : "-"}</td>
                    <td className="px-3 py-2">{data ? labelOf(sourceOptions, data.source) : "-"}</td>
                    <td className="px-3 py-2">{data ? labelOf(intentionOptions, data.intentionLevel) : "-"}</td>
                    <td className="px-3 py-2">{data ? labelOf(stageOptions, data.stage) : "-"}</td>
                    <td className="px-3 py-2">{data?.ownerEmail || (data?.ownerId ? "已选择默认负责人" : "未分配")}</td>
                    <td className="px-3 py-2">{data?.businessLineNames.join("、") || "-"}</td>
                    <td className="px-3 py-2">{data?.tags.join("、") || "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-md px-2 py-1 text-xs ${statusBadge(row.status)}`}>{summarizeRowStatus(row.status)}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.errorMessage ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

function BatchHistory({ batches }: { batches: Awaited<ReturnType<typeof prisma.importBatch.findMany>> }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-950">导入记录</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">文件名</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">总行数</th>
              <th className="px-3 py-2">成功</th>
              <th className="px-3 py-2">失败</th>
              <th className="px-3 py-2">重复</th>
              <th className="px-3 py-2">跳过</th>
              <th className="px-3 py-2">生成任务</th>
              <th className="px-3 py-2">创建时间</th>
              <th className="px-3 py-2">完成时间</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{batch.fileName}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-md px-2 py-1 text-xs ${statusBadge(batch.status)}`}>{batch.status}</span>
                </td>
                <td className="px-3 py-2">{batch.totalRows}</td>
                <td className="px-3 py-2">{batch.successRows}</td>
                <td className="px-3 py-2">{batch.failedRows}</td>
                <td className="px-3 py-2">{batch.duplicateRows}</td>
                <td className="px-3 py-2">{batch.skippedRows}</td>
                <td className="px-3 py-2">{batch.generatedTaskRows}</td>
                <td className="px-3 py-2">{formatDate(batch.createdAt)}</td>
                <td className="px-3 py-2">{formatDate(batch.completedAt)}</td>
              </tr>
            ))}
            {!batches.length ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                  暂无导入记录。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default async function ImportsPage({ params }: { params: { tenantSlug: string } }) {
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);

  const [batches, latestPreviewBatch, owners, businessLines] = await Promise.all([
    prisma.importBatch.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.importBatch.findFirst({
      where: {
        tenantId: tenant.id,
        status: { in: [ImportBatchStatus.PREVIEWED, ImportBatchStatus.PENDING, ImportBatchStatus.FAILED, ImportBatchStatus.COMPLETED] }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        status: "active",
        role: { in: ["TENANT_ADMIN", "OPERATOR", "SALES"] }
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    }),
    prisma.businessLine.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
    })
  ]);
  const latestPreviewRows = latestPreviewBatch
    ? await prisma.importRow.findMany({
        where: { tenantId: tenant.id, batchId: latestPreviewBatch.id },
        orderBy: { rowIndex: "asc" },
        take: 100
      })
    : [];

  return (
    <PageShell
      tenant={tenant}
      title="客户导入"
      description="把已有客户、活动名单、表单线索或历史客户导入系统，统一进入客户跟进、标签、业务线和任务管理。"
    >
      <ImportTips />
      <div className="space-y-6">
        <UploadSection tenantSlug={tenant.slug} />
        {latestPreviewBatch ? (
          <PreviewSection
            tenantSlug={tenant.slug}
            batch={latestPreviewBatch as Awaited<ReturnType<typeof prisma.importBatch.findFirstOrThrow>>}
            rows={parsePreviewRows(latestPreviewRows)}
            owners={owners}
            businessLines={businessLines}
          />
        ) : null}
        <BatchHistory batches={batches} />
      </div>
    </PageShell>
  );
}
