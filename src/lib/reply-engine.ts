/*
 * 文件说明：该文件是 V2.2 AI 推荐回复生成引擎的分组入口。
 * 功能说明：从 market-claw.ts 重新导出销售侧回复生成、知识选择和推荐结果解析能力。
 *
 * 结构概览：
 *   第一部分：回复生成导出
 */
export {
  generateMarketClawReply,
  parseMarketClawSuggestedTags,
  parseMarketClawSuggestedTask,
  pickMarketClawKnowledge,
  splitKnowledgeIdsByScope
} from "@/lib/market-claw";
