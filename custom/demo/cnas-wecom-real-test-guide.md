# CNAS 企业微信真实轻接入测试说明

## 1. 本说明用途

本说明用于 V2.7 阶段把 CNAS 企业微信外部联系人新增事件接入 MarketClaw。目标是验证“客户扫码添加企业微信后，能进入 MarketClaw 客户池并触发销售跟进”，不验证聊天同步、自动回复、AI Agent 或会话存档。

## 2. 企业微信后台配置

在企业微信后台准备客户联系能力，并把回调配置到 MarketClaw 租户：

- CorpID：企业微信企业 ID。
- Secret：具备客户联系读取权限的 Secret。
- AgentID：用于标识当前应用。
- Token：用于回调签名校验。
- EncodingAESKey：用于回调消息解密。
- 回调 URL：`https://<公网域名>/api/wecom/zhengmu-platform/callback`。

本地联调时可用内网穿透把 `http://127.0.0.1:3000` 暴露到公网，再把公网地址填入企业微信后台。

## 3. MarketClaw 配置页

进入：

- `/app/zhengmu-platform/wecom`

确认：

- 配置状态为 `enabled`。
- CorpID、Secret、AgentID、Token、EncodingAESKey、回调 URL 均已填写。
- 页面显示“真实回调可测试”。
- 销售或运营成员已绑定企业微信成员 ID。

## 4. URL 验证

企业微信后台保存回调 URL 时会发起 URL 验证。MarketClaw 会：

1. 使用 Token 校验 `msg_signature`。
2. 使用 EncodingAESKey 解密 `echostr`。
3. 校验 CorpID。
4. 返回解密后的明文。

若失败，优先检查 Token、EncodingAESKey、CorpID 是否与企业微信后台一致。

## 5. 外部联系人新增事件

客户扫码添加成员企业微信后，企业微信会推送 `change_external_contact / add_external_contact` 事件。MarketClaw 会：

1. 校验签名。
2. 解密事件 XML。
3. 记录 `WecomCallbackEvent` 原始日志。
4. 根据 `external_userid` 拉取外部联系人基础资料。
5. 生成或更新 `Lead`。
6. 写入 `LeadSourceAttribution`，来源标记为“企业微信”。
7. 根据成员绑定关系分配负责人。
8. CNAS 模板租户自动进入 CNAS 初步判断与跟进任务。

## 6. 明确不做

- 不做聊天同步。
- 不做自动回复。
- 不做 AI Agent。
- 不接会话存档。
- 不读取或保存客户聊天内容。
- 不扩大 SALES 权限。

## 7. 排查入口

- 企微配置与回调事件：`/app/zhengmu-platform/wecom`
- 客户列表：`/app/zhengmu-platform/leads`
- 客户详情：查看“企业微信承接信息”和“来源归因”
- 审计日志：`/app/zhengmu-platform/audit-logs`

## 8. 本地 smoke

V2.7 smoke 使用加密回调模拟企业微信 URL 验证和外部联系人新增事件：

```powershell
npx.cmd playwright test tests/v27-cnas-wecom-real-intake-smoke-e2e.spec.ts --workers=1 --reporter=list
```

smoke 中 `wm_v27_` 前缀的 external_userid 会走本地模拟资料，避免测试依赖真实企业微信网络；真实企业微信事件不会使用该前缀，会走企业微信外部联系人基础资料拉取。
