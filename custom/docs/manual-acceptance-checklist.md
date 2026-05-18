# 人工验收表

## 使用说明

请按实际体验逐项填写“实际结果 / 是否通过 / 备注”。

| 验收项 | 操作路径 | 预期结果 | 实际结果 | 是否通过 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 启动验收 | `start-local-demo.ps1` | 本地 PostgreSQL、Prisma、seed、Next.js 可顺利启动 |  |  |  |
| 登录验收 | `/login` | 演示账号可正常登录 |  |  |  |
| 权限验收 | 平台管理员 / 企业管理员 / 运营 / 销售分别登录 | 不同角色看到的入口符合权限边界 |  |  |  |
| 初始化向导演收 | `/app/zhengmu-platform/onboarding` | 管理员和运营可访问，销售不可访问 |  |  |  |
| 客户管理验收 | `/app/zhengmu-platform/leads` | 可看到客户列表、标签、来源归因入口 |  |  |  |
| 业务配置验收 | `/app/zhengmu-platform/business-lines` | 可看到业务线与配置总览 |  |  |  |
| Market Claw 知识库验收 | `/app/zhengmu-platform/market-claw/knowledge` | 可看到已采纳知识与来源提示 |  |  |  |
| 资料投喂验收 | `/app/zhengmu-platform/market-claw/ingestion` | 可创建资料投喂并生成候选知识 |  |  |  |
| 候选知识合并验收 | 资料投喂候选审核区 | 可看到相似提示、合并、追加、重复驳回 |  |  |  |
| 销售我的训练验收 | `/app/zhengmu-platform/market-claw/training` | 销售可提交训练样本、保存个人话术 |  |  |  |
| 管理侧训练审核验收 | `/app/zhengmu-platform/market-claw/training/review` | 管理员或运营可采纳 / 驳回训练样本 |  |  |  |
| 训练复盘验收 | `/app/zhengmu-platform/market-claw/insights` | 可看到总览、高频问题、风险问题、知识缺口、阶段建议 |  |  |  |
| 审计日志验收 | `/app/zhengmu-platform/audit-logs` | 可看到关键动作日志 |  |  |  |
| 页面体验验收 | 首页 / 导航 / 关键流程页 | 入口清晰、路径顺手、角色视图不混乱 |  |  |  |
| 最终试点准备度判断 | 初始化向导第七步 | 可判断当前是否适合内部试用或熟客共创试点 |  |  |  |
