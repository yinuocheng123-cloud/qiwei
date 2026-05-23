/*
 * 文件说明：该文件是 V2.2 客户跟进主线的 Server Actions 分组入口。
 * 功能说明：从原 actions.ts 中按客户、跟进和客户详情页使用场景重新导出相关动作，先降低页面对巨型 actions 文件的直接耦合。
 *
 * 结构概览：
 *   第一部分：客户与跟进动作导出
 */
export {
  addFollowUp,
  assignLeadOwner,
  bulkUpdateLeads,
  createManualTask,
  confirmReplySuggestionTags,
  generateReplySuggestionsForLead,
  saveReplySuggestionAsFollowUp
} from "@/lib/actions";
