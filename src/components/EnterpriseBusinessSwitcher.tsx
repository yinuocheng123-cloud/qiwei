"use client";

/*
 * 文件说明：该组件实现 MarketClaw V3.0 顶部企业 / 业务线双切换。
 * 功能说明：根据当前 URL 查询参数切换 enterpriseKey 与 businessLineKey，并在切企业时自动重置业务线。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：切换组件
 *   第三部分：URL 参数同步逻辑
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getBusinessLineDefinition, getBusinessLinesForEnterprise, marketClawEnterprises, type MarketClawBusinessLineKey, type MarketClawEnterpriseKey } from "@/lib/marketclaw-context";

type Props = {
  enterpriseKey?: string | null;
  businessLineKey?: string | null;
};

export function EnterpriseBusinessSwitcher({ enterpriseKey, businessLineKey }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentEnterpriseKey = (enterpriseKey as MarketClawEnterpriseKey | null) ?? marketClawEnterprises[0].key;
  const businessLines = getBusinessLinesForEnterprise(currentEnterpriseKey);
  const currentBusinessLine = getBusinessLineDefinition(currentEnterpriseKey, businessLineKey);

  function pushScope(nextEnterpriseKey: MarketClawEnterpriseKey, nextBusinessLineKey: MarketClawBusinessLineKey) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("enterpriseKey", nextEnterpriseKey);
    params.set("businessLineKey", nextBusinessLineKey);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="min-w-[180px]">
        <p className="text-xs font-medium text-slate-500">当前企业</p>
        <select
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          value={currentEnterpriseKey}
          onChange={(event) => {
            const nextEnterpriseKey = event.target.value as MarketClawEnterpriseKey;
            const nextBusinessLines = getBusinessLinesForEnterprise(nextEnterpriseKey);
            pushScope(nextEnterpriseKey, nextBusinessLines[0].key);
          }}
        >
          {marketClawEnterprises.map((item) => (
            <option key={item.key} value={item.key}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[220px]">
        <p className="text-xs font-medium text-slate-500">当前业务线</p>
        <select
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          value={currentBusinessLine.key}
          onChange={(event) => pushScope(currentEnterpriseKey, event.target.value as MarketClawBusinessLineKey)}
        >
          {businessLines.map((item) => (
            <option key={item.key} value={item.key}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs leading-5 text-slate-500">切换后，客户类型、资料包、任务模板和 Insights 会按当前企业与业务线隔离显示。</p>
    </div>
  );
}
