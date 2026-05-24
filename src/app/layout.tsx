import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketClaw 销售助手",
  description: "客户跟进与销售协作工作台底座，AI 和企业微信仅作为可选连接能力预留。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
