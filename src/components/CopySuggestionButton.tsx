"use client";

/*
 * 文件说明：该文件提供智能跟进助手的复制按钮。
 * 功能说明：把建议回复复制到剪贴板，并给出轻量成功提示。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：复制按钮组件
 */
import { useState } from "react";

export function CopySuggestionButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" type="button" onClick={handleCopy}>
      {copied ? "已复制" : "复制建议回复"}
    </button>
  );
}
