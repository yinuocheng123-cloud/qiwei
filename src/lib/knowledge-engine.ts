/*
 * 文件说明：该文件是 V2.2 知识维护与资料投喂引擎的分组入口。
 * 功能说明：从 market-claw.ts 重新导出候选知识生成、相似知识查找、合并内容和数组解析能力。
 *
 * 结构概览：
 *   第一部分：知识治理导出
 */
export {
  buildMarketClawMergedKnowledgeContent,
  findSimilarKnowledgeItems,
  generateMarketClawKnowledgeCandidates,
  parseMarketClawSimilarityHints,
  parseMarketClawTextArray
} from "@/lib/market-claw";
