-- 文件说明：为 CNAS 项目接入补充通用扩展字段与表单类型。
-- 功能说明：为 Lead、IntakeForm 增加 extraData JSONB 字段，并新增 cnas_path_check 表单枚举值。
--
-- 结构概览：
--   第一部分：扩展 FormType 枚举
--   第二部分：补充 Lead 扩展字段
--   第三部分：补充 IntakeForm 扩展字段

ALTER TYPE "FormType" ADD VALUE IF NOT EXISTS 'cnas_path_check';

ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "extraData" JSONB;

ALTER TABLE "IntakeForm"
ADD COLUMN IF NOT EXISTS "extraData" JSONB;
