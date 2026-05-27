-- 文件说明：为租户补充轻量模板标识字段。
-- 功能说明：只记录当前租户使用的样板类型，不引入模板系统、模板表或模板运行时。

ALTER TABLE "Tenant" ADD COLUMN "templateKey" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "templateName" TEXT;
