/*
 * 文件说明：该文件集中放置 V1.7 业务线／产品管理的解析、匹配与展示工具。
 * 功能说明：负责业务线 Json 字段解析、slug 生成、关键词匹配和推荐标签读取。
 *
 * 结构概览：
 *   第一部分：导入依赖与基础类型
 *   第二部分：Json 解析与文本转换
 *   第三部分：业务线匹配与推荐工具
 *   第四部分：展示辅助工具
 */
import type { BusinessLine, BusinessLineStatus, CustomerType } from "@prisma/client";

export type BusinessLineTagGroup = "客户类型标签" | "需求标签" | "阶段标签" | "业务标签" | "风险标签";

export type BusinessLineRecommendedTag = {
  tagName: string;
  tagGroup: BusinessLineTagGroup;
};

export type BusinessLineRecord = Pick<
  BusinessLine,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "status"
  | "priority"
  | "targetCustomerTypes"
  | "recommendedTagNames"
  | "recommendedMaterialIds"
  | "recommendedTaskTemplateIds"
  | "defaultNextAction"
  | "notes"
>;

const allowedTagGroups: BusinessLineTagGroup[] = ["客户类型标签", "需求标签", "阶段标签", "业务标签", "风险标签"];
const shortKeywordWhitelist = new Set(["ai", "geo", "seo", "crm", "scrm", "cnas"]);

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[【】（）()［］\[\]{}「」『』《》<>“”"'`]+/g, "")
    .replace(/[／/\\|·,，。；;：:、\s_-]+/g, "");
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function buildBusinessLineSlug(name: string, rawSlug?: string) {
  const source = (rawSlug ?? name).trim().toLowerCase();
  const normalized = source
    .replace(/[／/\\|·]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || `business-line-${Date.now()}`;
}

export function parseBusinessLineCustomerTypes(value: BusinessLine["targetCustomerTypes"]): CustomerType[] {
  return toArray(value).filter((item): item is CustomerType => typeof item === "string");
}

export function parseBusinessLineRecommendedTags(value: BusinessLine["recommendedTagNames"]): BusinessLineRecommendedTag[] {
  return toArray(value).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const tagName = typeof item.tagName === "string" ? item.tagName.trim() : "";
    const tagGroup = typeof item.tagGroup === "string" ? item.tagGroup.trim() : "";

    if (!tagName || !allowedTagGroups.includes(tagGroup as BusinessLineTagGroup)) {
      return [];
    }

    return [
      {
        tagName,
        tagGroup: tagGroup as BusinessLineTagGroup
      }
    ];
  });
}

export function parseBusinessLineIdList(
  value: BusinessLine["recommendedMaterialIds"] | BusinessLine["recommendedTaskTemplateIds"]
) {
  return toArray(value).filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function stringifyBusinessLineRecommendedTags(tags: BusinessLineRecommendedTag[]) {
  return tags.map((tag) => `${tag.tagName}|${tag.tagGroup}`).join("\n");
}

export function parseBusinessLineRecommendedTagText(value?: string) {
  if (!value) return [];

  const parsed = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [rawName, rawGroup] = line.split("|").map((part) => part.trim());
      if (!rawName) return [];

      const tagGroup = allowedTagGroups.includes(rawGroup as BusinessLineTagGroup)
        ? (rawGroup as BusinessLineTagGroup)
        : "业务标签";

      return [{ tagName: rawName, tagGroup }];
    });

  const seen = new Set<string>();
  return parsed.filter((tag) => {
    const key = `${tag.tagGroup}::${tag.tagName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractKeywordsFromText(text?: string | null) {
  if (!text) return [];

  const fragments = text
    .split(/[\s,，。；;：:、／\/\\|（）()【】\[\]{}《》<>-]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return uniqueStrings(
    fragments.filter((fragment) => {
      const normalized = normalizeToken(fragment);
      return normalized.length >= 2 || shortKeywordWhitelist.has(normalized);
    })
  );
}

function businessLineSearchTokens(line: BusinessLineRecord) {
  const baseTokens = [
    ...extractKeywordsFromText(line.name),
    ...extractKeywordsFromText(line.slug),
    ...extractKeywordsFromText(line.description),
    ...extractKeywordsFromText(line.defaultNextAction),
    ...extractKeywordsFromText(line.notes)
  ];

  const tagTokens = parseBusinessLineRecommendedTags(line.recommendedTagNames).flatMap((tag) => extractKeywordsFromText(tag.tagName));

  return uniqueStrings([...baseTokens, ...tagTokens]);
}

export function isBusinessLineVisibleToCustomerType(line: BusinessLineRecord, customerType: CustomerType) {
  const targetCustomerTypes = parseBusinessLineCustomerTypes(line.targetCustomerTypes);
  return !targetCustomerTypes.length || targetCustomerTypes.includes(customerType);
}

export function matchBusinessLinesForQuestion(input: {
  businessLines: BusinessLineRecord[];
  customerType: CustomerType;
  customerQuestion: string;
}) {
  const normalizedQuestion = normalizeToken(input.customerQuestion);
  if (!normalizedQuestion) return [];

  return input.businessLines
    .filter((line) => line.status === "ACTIVE")
    .filter((line) => isBusinessLineVisibleToCustomerType(line, input.customerType))
    .map((line) => {
      const tokens = businessLineSearchTokens(line).map(normalizeToken).filter(Boolean);
      const matchedTokens = tokens.filter((token) => normalizedQuestion.includes(token));
      return { line, matchedTokens };
    })
    .filter((item) => item.matchedTokens.length > 0)
    .sort((left, right) => {
      if (left.line.priority !== right.line.priority) {
        return left.line.priority - right.line.priority;
      }
      if (left.matchedTokens.length !== right.matchedTokens.length) {
        return right.matchedTokens.length - left.matchedTokens.length;
      }
      return left.line.name.localeCompare(right.line.name, "zh-CN");
    });
}

export function getActiveBusinessLineStatus(value: BusinessLineStatus) {
  return value === "ACTIVE";
}

export function countBusinessLineTags(line: Pick<BusinessLine, "recommendedTagNames">) {
  return parseBusinessLineRecommendedTags(line.recommendedTagNames).length;
}

export function countBusinessLineMaterials(line: Pick<BusinessLine, "recommendedMaterialIds">) {
  return parseBusinessLineIdList(line.recommendedMaterialIds).length;
}

export function countBusinessLineTaskTemplates(line: Pick<BusinessLine, "recommendedTaskTemplateIds">) {
  return parseBusinessLineIdList(line.recommendedTaskTemplateIds).length;
}
