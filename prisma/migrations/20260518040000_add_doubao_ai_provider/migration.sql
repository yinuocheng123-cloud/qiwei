-- 文件说明：该迁移为 V2.1.6 增加豆包 / 火山方舟 AI Provider 枚举值。
-- 功能说明：只扩展 AiProvider enum，不改变既有 AI 配置表结构和调用日志结构。
-- 结构概览：
--   第一部分：扩展 AiProvider 枚举

-- ========== 第一部分：扩展 AiProvider 枚举 ==========
-- 为什么：火山方舟兼容 OpenAI Chat Completions，本轮只需要新增 Provider 标识，调用仍复用统一服务层。
ALTER TYPE "AiProvider" ADD VALUE IF NOT EXISTS 'DOUBAO';
