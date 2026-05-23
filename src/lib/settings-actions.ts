/*
 * 文件说明：该文件是 V2.2 系统设置相关 Server Actions 分组入口。
 * 功能说明：集中导出 AI、企业微信、合规、租户和基础配置动作，避免销售主线页面直接感知后台设置动作。
 *
 * 结构概览：
 *   第一部分：平台和租户动作
 *   第二部分：系统设置动作
 */
export {
  clearAiProviderConfig,
  createBusinessLine,
  createMaterial,
  createTenant,
  sendWecomTestNotification,
  testTenantAiProviderConfig,
  triggerWecomInternalNotification,
  updateBusinessLine,
  updateBusinessLineStatus,
  updateMaterial,
  updateStrategy,
  updateTenantStatus,
  upsertAiProviderConfig,
  upsertCommunicationComplianceConfig,
  upsertUserWecomBinding,
  upsertWeComConfig
} from "@/lib/actions";
