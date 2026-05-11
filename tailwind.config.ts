/*
 * 文件说明：该文件配置 Tailwind CSS 扫描范围。
 * 功能说明：让 App Router 页面、组件和工具函数中的样式类参与构建。
 *
 * 结构概览：
 *   第一部分：导出 Tailwind 配置
 */
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {}
  },
  plugins: []
};

export default config;
