/*
 * 文件说明：该文件集中维护 V1.0 页面表单使用的枚举选项。
 * 功能说明：保证页面展示、筛选与 Prisma 枚举值保持一致，避免散落硬编码。
 *
 * 结构概览：
 *   第一部分：通用选项类型
 *   第二部分：业务枚举选项
 *   第三部分：标签与格式化工具
 */
export type Option = {
  value: string;
  label: string;
};

export const sourceOptions: Option[] = [
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "shipinhao", label: "视频号" },
  { value: "gongzhonghao", label: "公众号" },
  { value: "website", label: "官网" },
  { value: "friend_circle", label: "朋友圈" },
  { value: "offline_event", label: "线下活动" },
  { value: "referral", label: "转介绍" },
  { value: "other", label: "其他" }
];

export const customerTypeOptions: Option[] = [
  { value: "OWNER_CLIENT", label: "业主客户" },
  { value: "DEALER_CLIENT", label: "经销商客户" },
  { value: "DESIGNER_CLIENT", label: "设计师客户" },
  { value: "FACTORY_CLIENT", label: "工厂客户" },
  { value: "CHANNEL_PARTNER", label: "渠道伙伴" },
  { value: "OLD_CLIENT", label: "老客户" },
  { value: "PLATFORM_FACTORY_OWNER", label: "整木工厂老板" },
  { value: "PLATFORM_MEMBERSHIP_CLIENT", label: "会员意向客户" },
  { value: "PLATFORM_GEO_AI_CLIENT", label: "GEO／AI 推广客户" },
  { value: "PLATFORM_TRAINING_CLIENT", label: "培训课程客户" },
  { value: "PLATFORM_EVENT_RESOURCE_CLIENT", label: "活动／乌镇资源客户" },
  { value: "PLATFORM_SUPPLY_CHAIN_CLIENT", label: "供应链／集采客户" },
  { value: "PLATFORM_AFTERMARKET_CLIENT", label: "一清一护后市场客户" },
  { value: "PLATFORM_PARTNER_CLIENT", label: "合作伙伴客户" },
  { value: "OTHER", label: "其他" }
];

export const needTypeOptions: Option[] = [
  { value: "PRODUCT_INQUIRY", label: "产品咨询" },
  { value: "COOPERATION", label: "合作咨询" },
  { value: "GET_MATERIAL", label: "领取资料" },
  { value: "ASK_PRICE", label: "询价" },
  { value: "BOOK_CONSULTATION", label: "预约咨询" },
  { value: "AFTER_SALES", label: "售后" },
  { value: "INVESTMENT_JOIN", label: "招商加盟" },
  { value: "GROWTH_SYSTEM", label: "增长系统" },
  { value: "OTHER", label: "其他" }
];

export const intentionOptions: Option[] = [
  { value: "LOW", label: "低" },
  { value: "MEDIUM", label: "中" },
  { value: "HIGH", label: "高" },
  { value: "STRONG", label: "强" }
];

export const stageOptions: Option[] = [
  { value: "NEW", label: "新线索" },
  { value: "MATERIAL_SENT", label: "已发资料" },
  { value: "CONTACTED", label: "已联系" },
  { value: "DIAGNOSED", label: "已诊断" },
  { value: "QUOTED", label: "已报价" },
  { value: "PENDING_DEAL", label: "待成交" },
  { value: "DEAL_DONE", label: "已成交" },
  { value: "LOST", label: "已流失" },
  { value: "TO_REACTIVATE", label: "待激活" }
];

export const dealStatusOptions: Option[] = [
  { value: "NONE", label: "无" },
  { value: "PENDING", label: "跟进中" },
  { value: "WON", label: "已成交" },
  { value: "LOST", label: "已流失" }
];

export const materialTypeOptions: Option[] = [
  { value: "link", label: "链接" },
  { value: "pdf", label: "PDF" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "document", label: "文档" }
];

export const businessLineStatusOptions: Option[] = [
  { value: "ACTIVE", label: "启用中" },
  { value: "PAUSED", label: "已暂停" },
  { value: "ARCHIVED", label: "已归档" }
];

export const businessLineCategoryOptions: Option[] = [
  { value: "SERVICE", label: "服务" },
  { value: "PRODUCT", label: "产品" },
  { value: "ACTIVITY", label: "活动" },
  { value: "COURSE", label: "课程" },
  { value: "SUPPLY_CHAIN", label: "供应链" },
  { value: "MEMBERSHIP", label: "会员" },
  { value: "PARTNERSHIP", label: "合作" },
  { value: "OTHER", label: "其他" }
];

export const taskTypeOptions: Option[] = [
  { value: "FIRST_FOLLOW", label: "首次跟进" },
  { value: "SEND_MATERIAL", label: "发送资料" },
  { value: "PHONE_CALL", label: "电话沟通" },
  { value: "WECHAT_FOLLOW", label: "企微跟进" },
  { value: "QUOTE_FOLLOW", label: "报价跟进" },
  { value: "REACTIVATE", label: "客户激活" },
  { value: "VISIT_INVITE", label: "邀约到店" },
  { value: "DEAL_PUSH", label: "成交推进" },
  { value: "CUSTOM", label: "自定义" }
];

export const taskStatusOptions: Option[] = [
  { value: "PENDING", label: "待处理" },
  { value: "DONE", label: "已完成" },
  { value: "DELAYED", label: "已延期" },
  { value: "CANCELLED", label: "已取消" }
];

export const taskPriorityOptions: Option[] = [
  { value: "LOW", label: "低" },
  { value: "NORMAL", label: "普通" },
  { value: "HIGH", label: "高" },
  { value: "URGENT", label: "紧急" }
];

export function labelOf(options: Option[], value?: string | null) {
  return options.find((option) => option.value === value)?.label ?? value ?? "-";
}

export function formatDate(value?: Date | string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
