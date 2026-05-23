/*
 * 文件说明：该文件是 V2.2 AI 推荐回复与后台治理相关 Server Actions 分组入口。
 * 功能说明：把 Market Claw 生成、保存、审核、知识维护和资料投喂动作从页面导入层面单独收口。
 *
 * 结构概览：
 *   第一部分：AI 推荐回复动作导出
 *   第二部分：后台治理动作导出
 */
export {
  adoptMarketClawKnowledgeCandidate,
  createMarketClawFeedback,
  createMarketClawIngestionBatch,
  createMarketClawKnowledgeItem,
  createMarketClawTask,
  generateMarketClawReplyDraft,
  generateMarketClawSandboxAdvice,
  generateMarketClawTrainingCase,
  markMarketClawReplyCopied,
  mergeMarketClawKnowledgeCandidate,
  rejectMarketClawKnowledgeCandidate,
  reviewMarketClawTrainingCase,
  saveMarketClawReplyDraftAsFollowUp,
  saveMarketClawReplyDraftAsPersonalKnowledge,
  saveMarketClawSandboxTrainingDraft,
  saveMarketClawTrainingAsKnowledge,
  saveMarketClawTrainingAsPersonalKnowledge,
  submitMarketClawReplyDraftForReview,
  submitMarketClawTrainingForReview,
  updateMarketClawKnowledgeItem
} from "@/lib/actions";
