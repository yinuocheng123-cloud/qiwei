/*
 * 文件说明：该文件实现企业微信回调签名校验与消息解密工具。
 * 功能说明：负责 URL 验证签名、AES-CBC 解密、XML 轻量解析和回调响应拼装。
 *
 * 结构概览：
 *   第一部分：导入依赖与基础工具
 *   第二部分：企业微信签名与 AES 解密
 *   第三部分：XML 字段提取与回调载荷解析
 */
import crypto from "node:crypto";

export type WecomEncryptedCallbackQuery = {
  msgSignature?: string | null;
  timestamp?: string | null;
  nonce?: string | null;
};

export type ParsedWecomEvent = {
  toUserName?: string;
  fromUserName?: string;
  createTime?: string;
  msgType?: string;
  event?: string;
  changeType?: string;
  userId?: string;
  externalUserId?: string;
  state?: string;
  welcomeCode?: string;
};

function sha1(values: string[]) {
  return crypto.createHash("sha1").update(values.sort().join("")).digest("hex");
}

function decodeXmlValue(value?: string) {
  if (!value) return undefined;
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

export function verifyWecomSignature(input: {
  token?: string | null;
  msgSignature?: string | null;
  timestamp?: string | null;
  nonce?: string | null;
  encryptedText?: string | null;
}) {
  if (!input.token || !input.msgSignature || !input.timestamp || !input.nonce || !input.encryptedText) {
    return false;
  }
  return sha1([input.token, input.timestamp, input.nonce, input.encryptedText]) === input.msgSignature;
}

export function extractXmlField(xml: string, field: string) {
  const match = xml.match(new RegExp(`<${field}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${field}>`));
  return decodeXmlValue(match?.[1]?.trim());
}

export function extractWecomEncrypt(xml: string) {
  return extractXmlField(xml, "Encrypt");
}

function normalizeAesKey(encodingAESKey: string) {
  const key = Buffer.from(`${encodingAESKey}=`, "base64");
  if (key.length !== 32) {
    throw new Error("EncodingAESKey 解码后长度不正确。");
  }
  return key;
}

function stripPkcs7Padding(buffer: Buffer) {
  const pad = buffer[buffer.length - 1];
  if (pad < 1 || pad > 32) {
    return buffer;
  }
  return buffer.subarray(0, buffer.length - pad);
}

export function decryptWecomMessage(input: {
  encodingAESKey?: string | null;
  encryptedText: string;
  expectedCorpId?: string | null;
}) {
  if (!input.encodingAESKey) {
    throw new Error("未配置 EncodingAESKey，无法解密企业微信回调。");
  }

  const key = normalizeAesKey(input.encodingAESKey);
  const encryptedBuffer = Buffer.from(input.encryptedText, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, key.subarray(0, 16));
  decipher.setAutoPadding(false);

  const decrypted = stripPkcs7Padding(Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]));
  const messageLength = decrypted.readUInt32BE(16);
  const xml = decrypted.subarray(20, 20 + messageLength).toString("utf8");
  const receivedCorpId = decrypted.subarray(20 + messageLength).toString("utf8");

  // 这里校验 CorpID，是为了避免错误租户或错误 AESKey 的密文被误接入客户池。
  if (input.expectedCorpId && receivedCorpId && receivedCorpId !== input.expectedCorpId) {
    throw new Error("企业微信回调 CorpID 与当前租户配置不一致。");
  }

  return { xml, receivedCorpId };
}

export function parseWecomEventXml(xml: string): ParsedWecomEvent {
  return {
    toUserName: extractXmlField(xml, "ToUserName"),
    fromUserName: extractXmlField(xml, "FromUserName"),
    createTime: extractXmlField(xml, "CreateTime"),
    msgType: extractXmlField(xml, "MsgType"),
    event: extractXmlField(xml, "Event"),
    changeType: extractXmlField(xml, "ChangeType"),
    userId: extractXmlField(xml, "UserID"),
    externalUserId: extractXmlField(xml, "ExternalUserID"),
    state: extractXmlField(xml, "State"),
    welcomeCode: extractXmlField(xml, "WelcomeCode")
  };
}
