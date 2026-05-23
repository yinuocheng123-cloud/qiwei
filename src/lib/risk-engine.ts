/*
 * 文件说明：该文件是 V2.2 AI 推荐回复风险策略的分组入口。
 * 功能说明：从 market-claw.ts 重新导出风险识别、策略合并和风险标签，便于后续逐步拆出真实实现。
 *
 * 结构概览：
 *   第一部分：风险策略导出
 */
export {
  buildMarketClawReplyPolicy,
  detectRiskFromQuestion,
  inferMarketClawPolicy,
  marketClawReplyRiskLevelLabels,
  marketClawSendModeLabels,
  mergeAiRiskWithRuleRisk,
  normalizeAiRiskResult,
  resolveMarketClawKnowledgePolicy
} from "@/lib/market-claw";
