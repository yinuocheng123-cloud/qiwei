/*
 * 文件说明：该文件定义 Next.js 根布局。
 * 功能说明：引入全局样式并设置项目基础元信息。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：元信息
 *   第三部分：根布局组件
 */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "企业微信业务增长中台",
  description: "客户从网上来，企业微信接得住，销售跟得上，老板看得清。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
