/*
 * 文件说明：该文件集中定义 MarketClaw V3.0 的企业、业务线、客户类型和看板上下文。
 * 功能说明：为顶部双切换、seed、页面过滤和文案提供统一配置，避免不同页面各自硬编码。
 *
 * 结构概览：
 *   第一部分：类型定义
 *   第二部分：企业与业务线配置
 *   第三部分：客户类型与阶段映射
 *   第四部分：上下文查询工具
 */
import type { BusinessLineCategory, CustomerType, LeadStage } from "@prisma/client";

export type MarketClawEnterpriseKey = "hangyu" | "youshi";
export type MarketClawBusinessLineKey = "cnas" | "zhengmu" | "youxi";
export const DEFAULT_ENTERPRISE_KEY: MarketClawEnterpriseKey = "youshi";
export const DEFAULT_BUSINESS_LINE_KEY: MarketClawBusinessLineKey = "zhengmu";

export type MarketClawBusinessLineDefinition = {
  key: MarketClawBusinessLineKey;
  name: string;
  slug: string;
  category: BusinessLineCategory;
  description: string;
  defaultNextAction: string;
  customerTypes: Array<{ value: CustomerType; label: string }>;
  stageLabels?: Partial<Record<LeadStage, string>>;
  insightsMetrics: string[];
};

export type MarketClawEnterpriseDefinition = {
  key: MarketClawEnterpriseKey;
  name: string;
  description: string;
  businessLines: MarketClawBusinessLineDefinition[];
};

const cnasBusinessLine: MarketClawBusinessLineDefinition = {
  key: "cnas",
  name: "CNAS认可指南",
  slug: "cnas-guide",
  category: "SERVICE",
  description: "面向实验室认可咨询与诊断承接，按认可阶段推进资料、评估和诊断建议。",
  defaultNextAction: "先判断认可阶段，再补发路径表和诊断建议。",
  customerTypes: [
    { value: "CNAS_LAB_OWNER", label: "实验室负责人" },
    { value: "CNAS_BUSINESS_OWNER", label: "企业老板" },
    { value: "CNAS_QUALITY_OWNER", label: "质量负责人" },
    { value: "CNAS_TECH_OWNER", label: "技术负责人" },
    { value: "CNAS_TESTING_AGENCY", label: "检测机构客户" },
    { value: "CNAS_CONSULTING_INTENT", label: "咨询意向客户" }
  ],
  stageLabels: {
    NEW: "待初步判断",
    MATERIAL_SENT: "已发认可路径表",
    CONTACTED: "待电话评估",
    DIAGNOSED: "待出诊断建议",
    QUOTED: "高意向认可客户",
    PENDING_DEAL: "待签约推进",
    DEAL_DONE: "已签约",
    LOST: "暂缓认可",
    TO_REACTIVATE: "待重新激活"
  },
  insightsMetrics: [
    "今日新增咨询",
    "待初步判断客户",
    "已发认可路径表",
    "待电话评估客户",
    "高意向认可客户",
    "逾期未跟进客户",
    "各客户类型数量",
    "各认可阶段数量",
    "资料发送次数",
    "待出诊断建议客户"
  ]
};

const zhengmuBusinessLine: MarketClawBusinessLineDefinition = {
  key: "zhengmu",
  name: "整木网",
  slug: "zhengmu-growth",
  category: "MEMBERSHIP",
  description: "面向整木行业内容增长、会员转化和合作承接，区分会员、GEO、门店与供应链场景。",
  defaultNextAction: "先判断客户属于会员、GEO、门店还是供应链，再发对应资料和推进动作。",
  customerTypes: [
    { value: "ZHENGMU_FACTORY_OWNER", label: "整木工厂老板" },
    { value: "ZHENGMU_GEO_INTENT", label: "GEO意向客户" },
    { value: "ZHENGMU_MEMBERSHIP_INTENT", label: "会员意向客户" },
    { value: "ZHENGMU_STORE_CLIENT", label: "门店客户" },
    { value: "ZHENGMU_SUPPLIER_CLIENT", label: "供应商客户" },
    { value: "ZHENGMU_TIANTUAN_CLIENT", label: "天团客户" }
  ],
  insightsMetrics: [
    "今日新增客户",
    "高意向客户",
    "逾期未跟进",
    "无负责人客户",
    "无下一步客户",
    "超过7天沉默客户",
    "各客户类型数量",
    "各销售跟进情况",
    "资料发送次数",
    "深度沟通客户数"
  ]
};

const youxiBusinessLine: MarketClawBusinessLineDefinition = {
  key: "youxi",
  name: "柚喜饰界",
  slug: "youxi-decoration",
  category: "PRODUCT",
  description: "面向柚木地板、整装、家具与设计合作承接，强调资料发送、进群和设计协同。",
  defaultNextAction: "先判断客户属于地板、整装、家具还是设计合作，再推进资料和进群动作。",
  customerTypes: [
    { value: "YOUXI_FLOORING_CLIENT", label: "柚木地板客户" },
    { value: "YOUXI_WHOLE_HOME_CLIENT", label: "柚木整装客户" },
    { value: "YOUXI_FURNITURE_CLIENT", label: "柚木家具客户" },
    { value: "YOUXI_DESIGNER_CLIENT", label: "设计师客户" },
    { value: "YOUXI_VENDOR_CLIENT", label: "推荐厂商客户" },
    { value: "YOUXI_COMMUNITY_CLIENT", label: "社群交流客户" }
  ],
  insightsMetrics: [
    "今日新增咨询",
    "柚木地板客户数",
    "柚木整装客户数",
    "柚木家具客户数",
    "设计师客户数",
    "推荐厂商客户数",
    "社群交流客户数",
    "已发资料次数",
    "待进群客户",
    "超过7天沉默客户"
  ]
};

export const marketClawEnterprises: MarketClawEnterpriseDefinition[] = [
  {
    key: "hangyu",
    name: "杭育公司",
    description: "以 CNAS 认可咨询和实验室诊断承接为主。",
    businessLines: [cnasBusinessLine]
  },
  {
    key: "youshi",
    name: "优势文化",
    description: "承接整木网与柚喜饰界两条业务线，分别处理整木增长与柚木产品合作。",
    businessLines: [zhengmuBusinessLine, youxiBusinessLine]
  }
];

const enterpriseMap = new Map(marketClawEnterprises.map((item) => [item.key, item]));
const businessLineMap = new Map(
  marketClawEnterprises.flatMap((enterprise) => enterprise.businessLines.map((businessLine) => [businessLine.key, businessLine] as const))
);

export function getEnterpriseDefinition(key?: string | null) {
  return enterpriseMap.get((key ?? DEFAULT_ENTERPRISE_KEY) as MarketClawEnterpriseKey) ?? enterpriseMap.get(DEFAULT_ENTERPRISE_KEY)!;
}

export function getBusinessLinesForEnterprise(enterpriseKey?: string | null) {
  return getEnterpriseDefinition(enterpriseKey).businessLines;
}

export function getBusinessLineDefinition(enterpriseKey?: string | null, businessLineKey?: string | null) {
  const businessLines = getBusinessLinesForEnterprise(enterpriseKey);
  const fallbackKey = getEnterpriseDefinition(enterpriseKey).key === DEFAULT_ENTERPRISE_KEY ? DEFAULT_BUSINESS_LINE_KEY : businessLines[0].key;
  return businessLines.find((item) => item.key === (businessLineKey ?? fallbackKey)) ?? businessLines[0];
}

export function getCustomerTypeLabel(value?: string | null) {
  if (!value) return "-";
  for (const enterprise of marketClawEnterprises) {
    const match = enterprise.businessLines.flatMap((line) => line.customerTypes).find((item) => item.value === value);
    if (match) return match.label;
  }
  return value;
}

export function getCustomerTypeOptionsForBusinessLine(enterpriseKey?: string | null, businessLineKey?: string | null) {
  return getBusinessLineDefinition(enterpriseKey, businessLineKey).customerTypes.map((item) => ({
    value: item.value,
    label: item.label
  }));
}

export function mapLegacyCustomerTypeToBusinessLineCustomerType(
  businessLineKey: MarketClawBusinessLineKey,
  customerType?: string | null
): CustomerType {
  if (!customerType) {
    return businessLineKey === "cnas"
      ? "CNAS_CONSULTING_INTENT"
      : businessLineKey === "youxi"
        ? "YOUXI_COMMUNITY_CLIENT"
        : "ZHENGMU_MEMBERSHIP_INTENT";
  }

  if (
    customerType.startsWith("CNAS_") ||
    customerType.startsWith("ZHENGMU_") ||
    customerType.startsWith("YOUXI_")
  ) {
    return customerType as CustomerType;
  }

  if (businessLineKey === "cnas") {
    const cnasFallbackMap: Record<string, CustomerType> = {
      OWNER_CLIENT: "CNAS_LAB_OWNER",
      DEALER_CLIENT: "CNAS_BUSINESS_OWNER",
      DESIGNER_CLIENT: "CNAS_QUALITY_OWNER",
      FACTORY_CLIENT: "CNAS_TECH_OWNER",
      OTHER: "CNAS_CONSULTING_INTENT"
    };
    return cnasFallbackMap[customerType] ?? "CNAS_CONSULTING_INTENT";
  }

  if (businessLineKey === "youxi") {
    const youxiFallbackMap: Record<string, CustomerType> = {
      OWNER_CLIENT: "YOUXI_FLOORING_CLIENT",
      DEALER_CLIENT: "YOUXI_VENDOR_CLIENT",
      DESIGNER_CLIENT: "YOUXI_DESIGNER_CLIENT",
      FACTORY_CLIENT: "YOUXI_WHOLE_HOME_CLIENT",
      CHANNEL_PARTNER: "YOUXI_VENDOR_CLIENT",
      OLD_CLIENT: "YOUXI_COMMUNITY_CLIENT",
      OTHER: "YOUXI_COMMUNITY_CLIENT"
    };
    return youxiFallbackMap[customerType] ?? "YOUXI_COMMUNITY_CLIENT";
  }

  const zhengmuFallbackMap: Record<string, CustomerType> = {
    OWNER_CLIENT: "ZHENGMU_GEO_INTENT",
    DEALER_CLIENT: "ZHENGMU_SUPPLIER_CLIENT",
    DESIGNER_CLIENT: "ZHENGMU_STORE_CLIENT",
    FACTORY_CLIENT: "ZHENGMU_FACTORY_OWNER",
    CHANNEL_PARTNER: "ZHENGMU_TIANTUAN_CLIENT",
    OLD_CLIENT: "ZHENGMU_MEMBERSHIP_INTENT",
    PLATFORM_FACTORY_OWNER: "ZHENGMU_FACTORY_OWNER",
    PLATFORM_MEMBERSHIP_CLIENT: "ZHENGMU_MEMBERSHIP_INTENT",
    PLATFORM_GEO_AI_CLIENT: "ZHENGMU_GEO_INTENT",
    PLATFORM_EVENT_RESOURCE_CLIENT: "ZHENGMU_TIANTUAN_CLIENT",
    PLATFORM_SUPPLY_CHAIN_CLIENT: "ZHENGMU_SUPPLIER_CLIENT",
    PLATFORM_PARTNER_CLIENT: "ZHENGMU_TIANTUAN_CLIENT",
    OTHER: "ZHENGMU_MEMBERSHIP_INTENT"
  };

  return zhengmuFallbackMap[customerType] ?? "ZHENGMU_MEMBERSHIP_INTENT";
}

export function getStageLabelForBusinessLine(
  stage: LeadStage,
  enterpriseKey?: string | null,
  businessLineKey?: string | null,
  fallback?: string
) {
  const businessLine = businessLineMap.get((businessLineKey ?? "") as MarketClawBusinessLineKey) ?? getBusinessLineDefinition(enterpriseKey, businessLineKey);
  return businessLine.stageLabels?.[stage] ?? fallback ?? stage;
}

export function getInsightsMetricsForBusinessLine(enterpriseKey?: string | null, businessLineKey?: string | null) {
  return getBusinessLineDefinition(enterpriseKey, businessLineKey).insightsMetrics;
}
