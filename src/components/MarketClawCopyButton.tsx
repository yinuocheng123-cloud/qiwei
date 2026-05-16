"use client";

/*
 * 文件说明：该文件提供麻虾智能回复的复制按钮。
 * 功能说明：把销售选择的回复复制到剪贴板，并提交服务端动作记录 useStatus 与审计日志。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：复制并记录按钮组件
 */
import { useRef, useState } from "react";

export function MarketClawCopyButton({
  action,
  draftId,
  selectedReplyType,
  salesEditedReply,
  text
}: {
  action: (formData: FormData) => Promise<void>;
  draftId: string;
  selectedReplyType: string;
  salesEditedReply?: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      formRef.current?.requestSubmit();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={action} ref={formRef}>
      <input name="draftId" type="hidden" value={draftId} />
      <input name="selectedReplyType" type="hidden" value={selectedReplyType} />
      <input name="salesEditedReply" type="hidden" value={salesEditedReply ?? ""} />
      <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" type="button" onClick={handleCopy}>
        {copied ? "已复制" : "复制回复"}
      </button>
    </form>
  );
}
