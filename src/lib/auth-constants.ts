/*
 * 文件说明：该文件集中维护认证相关 cookie 名称。
 * 功能说明：让 Node 服务端代码和 Edge middleware 使用同一组常量，避免字符串漂移。
 *
 * 结构概览：
 *   第一部分：cookie 常量导出
 */
export const SESSION_COOKIE_NAME = "growthhub_session";
export const AUTH_CONTEXT_COOKIE_NAME = "growthhub_auth_context";
