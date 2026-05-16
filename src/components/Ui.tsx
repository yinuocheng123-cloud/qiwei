/*
 * 文件说明：该文件提供 V1.0 页面通用 UI 小组件。
 * 功能说明：复用卡片、输入框、选择框和统计表格，保持页面实现轻量。
 *
 * 结构概览：
 *   第一部分：基础容器组件
 *   第二部分：表单组件
 *   第三部分：统计展示组件
 */
import type { Option } from "@/lib/options";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-md border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function Input({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  disabled
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
      />
    </label>
  );
}

export function Textarea({
  label,
  name,
  defaultValue,
  rows = 4,
  disabled
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <textarea
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        disabled={disabled}
      />
    </label>
  );
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  disabled
}: {
  label: string;
  name: string;
  options: Option[];
  defaultValue?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SubmitButton({ children = "保存" }: { children?: React.ReactNode }) {
  return <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">{children}</button>;
}

export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </Card>
  );
}

export function DistributionTable({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-slate-950">{title}</h2>
      <div className="space-y-2">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
              <span>{row.label}</span>
              <span className="font-semibold">{row.count}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">暂无数据</p>
        )}
      </div>
    </Card>
  );
}
