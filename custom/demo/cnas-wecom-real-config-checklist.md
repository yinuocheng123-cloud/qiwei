# CNAS 企业微信真实配置检查清单

## 1. 本清单用途

本清单用于 V2.7.1 阶段把企业微信真实轻接入落到可配置、可测试、可排错的流程。当前只验证“客户扫码添加企微后进入 MarketClaw”，不做聊天同步、不自动回复、不接 AI Agent、不采集会话存档。

## 2. 在哪里创建自建应用

1. 登录企业微信管理后台。
2. 进入“应用管理”。
3. 找到“自建”应用区域。
4. 点击“创建应用”，填写应用名称、Logo、可见范围等信息。
5. 创建完成后进入该应用详情页。

建议应用名称使用“CNAS 客户承接”或类似名称，避免和聊天、客服、会话存档类应用混淆。

## 3. CorpID 在哪里看

CorpID 是企业 ID，一般在企业微信管理后台的“我的企业”或“企业信息”页面查看。

填写到 MarketClaw：

- `/app/zhengmu-platform/wecom`
- 字段：`CorpId`

注意：CorpID 必须和回调解密后 `ToUserName` 中的企业 ID 一致，否则 URL 验证或事件解密会失败。

## 4. AgentID 在哪里看

AgentID 是自建应用的应用 ID。进入“应用管理”中的目标自建应用详情页后，在应用信息区域查看。

填写到 MarketClaw：

- 字段：`AgentId`

注意：V2.7.1 不用 AgentID 主动发消息，它只是用于配置完整性和后续排查；当前不会自动回复客户。

## 5. Secret 在哪里看

Secret 是自建应用的应用凭证。进入目标自建应用详情页，在 Secret 区域查看或重置。

填写到 MarketClaw：

- 字段：`Secret（保存后不完整回显）`

注意：

- Secret 需要具备客户联系相关读取权限，真实事件承接时会用它获取 `access_token` 并拉取外部联系人基础资料。
- MarketClaw 不会完整回显 Secret。
- 如果重新生成 Secret，需要同步更新 MarketClaw。

## 6. Token 怎么填

Token 用于企业微信回调签名校验。可以在企业微信自建应用的“接收消息”或“设置 API 接收”配置中填写。

建议：

- 使用 16 位以上随机字符串。
- 只使用英文、数字或安全符号。
- 企业微信后台和 MarketClaw 必须完全一致。

填写到 MarketClaw：

- 字段：`Token`

常见失败：

- 企业微信后台 Token 和 MarketClaw Token 不一致。
- 复制时多了空格。
- 使用了另一套环境的 Token。

## 7. EncodingAESKey 怎么生成

EncodingAESKey 用于回调消息解密。企业微信后台通常提供随机生成入口，也可以自行生成 43 位英文或数字字符串。

建议：

- 优先使用企业微信后台的“随机生成”。
- 复制后完整保存到 MarketClaw。
- 不要少复制或多复制字符。

填写到 MarketClaw：

- 字段：`EncodingAESKey`

常见失败：

- 长度不是 43 位。
- 企业微信后台和 MarketClaw 不一致。
- 复制了旧应用的 EncodingAESKey。

## 8. 回调 URL 应该填什么

真实公网环境：

```text
https://<你的公网域名>/api/wecom/zhengmu-platform/callback
```

本地联调环境：

```text
https://<内网穿透域名>/api/wecom/zhengmu-platform/callback
```

填写位置：

- 企业微信后台：目标自建应用的“接收消息”或“设置 API 接收”的 URL。
- MarketClaw：`CallbackUrl` 字段。

注意：

- 企业微信必须能从公网访问该 URL。
- URL 中的 `zhengmu-platform` 是租户 slug，需要和当前 CNAS 试点租户一致。
- 本地 `http://127.0.0.1:3000` 不能直接填给企业微信后台，需要先通过内网穿透变成 HTTPS 公网地址。

## 9. 如何验证 URL

1. 在 MarketClaw `/app/zhengmu-platform/wecom` 填好 CorpID、AgentID、Secret、Token、EncodingAESKey、CallbackUrl。
2. 将状态改为 `enabled` 并保存。
3. 回到企业微信后台，在“接收消息 / 设置 API 接收”中填同一套 URL、Token、EncodingAESKey。
4. 点击保存。
5. 企业微信会向 URL 发起 GET 验证。
6. MarketClaw 会校验签名、解密 `echostr`、校验 CorpID，并返回明文。

验证成功后，企业微信后台会允许保存；验证失败则不能完成配置。

## 10. 如何测试客户添加事件

1. 在 MarketClaw 的“成员 ID 绑定”里，把平台销售或负责人的企业微信成员 ID 填好并启用。
2. 在企业微信后台确认该成员拥有客户联系能力。
3. 让测试客户扫码添加该成员企业微信。
4. 企业微信推送 `change_external_contact / add_external_contact` 事件。
5. MarketClaw 接收回调后写入 `WecomCallbackEvent`。
6. 如果处理成功，客户会进入 `/app/zhengmu-platform/leads`。
7. 打开客户详情，确认：
   - “企业微信承接信息”显示 external_userid、添加时间、负责人、承接状态。
   - “来源归因”显示来源为“企业微信”。
   - CNAS 模板客户生成 CNAS 初步判断和跟进任务。

## 11. 在 MarketClaw 哪里看是否接通

进入：

```text
/app/zhengmu-platform/wecom
```

重点查看：

- “真实接入检查清单”：确认 CorpID、Secret、Token、EncodingAESKey、回调 URL 是否已填。
- “当前接入状态”：
  - `未配置`：必要字段未填完整，或状态未启用。
  - `待验证`：字段已填完整，但还没有收到可解密回调。
  - `已收到回调`：已经收到至少一条签名通过且解密成功的回调。
- “最近回调事件”：查看事件类型、处理状态和时间。
- “最近错误信息”：查看签名、解密、资料拉取或事件处理失败原因。
- “真实回调事件日志”：查看每条回调是否 `PROCESSED`、`FAILED`、`IGNORED` 或 `INVALID_SIGNATURE`。

## 12. 常见失败原因

### URL 验证失败

- 回调 URL 不是公网 HTTPS。
- 内网穿透地址已失效。
- 企业微信后台 Token 与 MarketClaw Token 不一致。
- EncodingAESKey 不一致或长度错误。
- CorpID 填错。
- MarketClaw 配置状态不是 `enabled`。

### 收不到客户添加事件

- 企业微信后台没有开启客户联系相关事件回调。
- 客户添加的不是绑定的企业微信成员。
- 成员不在自建应用可见范围内。
- 成员没有客户联系权限。
- 回调 URL 填到了错误租户。

### 事件收到但处理失败

- Secret 没有客户联系读取权限。
- Secret 已重置但 MarketClaw 未更新。
- 拉取外部联系人资料时企业微信返回错误码。
- `external_userid` 缺失。
- 成员企业微信 UserID 未绑定到 MarketClaw 用户，导致负责人只能走默认分配。

### 客户生成了但看不到

- 当前登录用户没有该客户访问权限。
- 客户分配给了其他负责人。
- 客户列表筛选条件未清空。
- 事件更新了已有客户，而不是创建新客户。

## 13. 本阶段明确不做

- 不同步聊天记录。
- 不自动回复客户。
- 不做 AI Agent。
- 不接会话存档。
- 不采集客户会话内容。
- 不扩大 SALES 权限。
