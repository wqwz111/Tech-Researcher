# 🏷️ Issue 标签体系与使用指南

欢迎对 Tech-Researcher 报告提出反馈！本文档说明我们的 Issue 标签分类、使用场景和提交规范。

---

## 📋 标签分类一览

我们的标签体系由 **三个维度** 组成：类别、优先级、状态。

### 1️⃣ 类别标签（必选其一）

| 标签 | 说明 | 适用场景 |
|------|------|----------|
| `improvement` | 报告/项目改进 | 数据有误、链接失效、排版问题、需要补充内容、模板优化 |
| `question` | 提问/交流 | 对报告内容有疑问、想深入讨论某个技术点、需要澄清 |
| `topic` | 选题/方向建议 | 推荐新的研究主题、建议技术方向、希望看到某篇报告 |

### 2️⃣ 优先级标签（`improvement` 类必填）

| 标签 | 说明 | 处理时效 |
|------|------|----------|
| `P0` | 必须修——事实错误、数据缺失、链接 404 | 24 小时内 |
| `P1` | 应该修——补充来源、优化表述、缺少引用 | 本周内 |
| `P2` | 锦上添花——排版微调、格式统一、视觉优化 | 下周计划 |

### 3️⃣ 状态标签（团队内部使用）

| 标签 | 说明 |
|------|------|
| `triage` | 待分类（新建 Issue 自动添加） |
| `in-progress` | 已确认，正在处理 |
| `done` | 已完成，待关闭 |

### 4️⃣ 报告定位标签（可选，方便筛选）

| 标签 | 覆盖报告 |
|------|----------|
| `report:mcp` | MCP 协议生态深度分析 |
| `report:rag` | RAG 架构设计模式全解析 |
| `report:inference` | 开源模型推理框架对比研究 |
| `report:openclaw` | OpenClaw 系列（架构/多Agent/ACP/企业部署）|
| `report:all` | 涉及多篇报告或全局性问题 |

---

## 🚀 快速上手

### 我发现报告里有个错误

1. 点击 [New Issue](https://github.com/wqwz111/Tech-Researcher/issues/new/choose)
2. 选择 **📝 改进反馈**
3. 填写报告路径、问题描述、建议修改
4. 勾选优先级（P0/P1/P2）
5. 提交后团队会自动收到通知

### 我想问个问题

1. 选择 **❓ 提问/交流** 模板
2. 写清楚你的问题和关联报告
3. 提交后主编会指派合适的探针回复

### 我希望你们研究某个方向

1. 选择 **💡 选题建议** 模板
2. 写明选题方向和推荐理由
3. 附上相关论文/文章链接更好
4. 主编会在制定研究计划时评估

---

## 📖 示例

### 示例 1：报告错误反馈

```
标题: [改进] rag-patterns.md 中 BM25 公式有误
标签: improvement, P0, report:rag

## 📝 改进点
第 2.2 节 BM25 公式中 k1 参数的说明写反了，
应该是"词频饱和度"而不是"文档长度归一化"。

## 📍 位置
报告: /reports/methodology/rag-patterns.md
章节: 2.2 稀疏检索（Sparse Retrieval）

## 🎯 建议修改
将"k1：文档长度归一化参数"改为"k1：词频饱和度参数（通常取 1.2-2.0）"

## 优先级
P0 — 事实错误
```

### 示例 2：技术提问

```
标题: [提问] SGLang 的 RadixAttention 和 vLLM 的 PagedAttention 本质区别？
标签: question, report:inference

## ❓ 问题
读完推理框架对比报告，不太理解 RadixAttention
和 PagedAttention 在 KV Cache 管理上的核心区别。
报告说 SGLang 用 radix tree，vLLM 用分页，
但实际性能差异不太大，为什么？

## 📍 关联报告
/reports/frameworks/inference-frameworks.md

## 补充背景
正在做推理框架选型，团队主要跑 Agent 类工作负载。
```

### 示例 3：选题建议

```
标题: [选题] 建议研究 MCP Security——远程 MCP 服务的安全威胁模型
标签: topic, report:mcp

## 💡 选题方向
MCP 协议生态报告提到了安全风险但没有展开。
建议专门写一篇 MCP 安全威胁模型分析。

## 🔥 推荐理由
- 企业采用 MCP 时最关心的就是安全问题
- 远程 MCP Server 的提示注入、数据泄露等攻击向量还不清晰
- 社区讨论很多但没有系统性总结

## 参考资料
- OWASP LLM Top 10: https://owasp.org/www-project-llm-top-10/
- MCP Security Discussion: https://github.com/modelcontextprotocol/discussions/xx
```

---

## 📖 读者评审

**每次报告发布或修改后，主编会自动创建评审 Issue，指派读者审阅。**

如果你收到了评审任务，请在 **24 小时内** 按以下维度评分：

| 维度 | 关注点 |
|------|--------|
| 事实准确性 | 数据是否准确？链接是否有效？ |
| 可读性 | Executive Summary 能独立理解吗？ |
| 逻辑完整性 | 论证是否完整？结论是否有数据支撑？ |
| 可操作性 | 对读者有实际指导价值吗？ |
| 来源质量 | 3+ 独立来源？2024-2025 年文献？ |

**评审格式**：每项 1-5 ⭐ + 逐条列出发现的问题（附 P0/P1/P2 优先级）

详见 [📖 读者评审模板](https://github.com/wqwz111/Tech-Researcher/issues/new?template=review.md)

---

## 🔄 Issue 处理流程

```
新建 Issue → triage 标签 → 主编分类评估 → 分派处理 → in-progress → done → 关闭
```

1. **新建**：Issue 自动获得 `triage` 标签
2. **分类**：主编在 24 小时内添加类别/优先级/报告标签
3. **处理**：
   - `improvement` → 分派探针修复
   - `question` → 分派对应领域探针回复
   - `topic` → 评估后加入研究计划或说明不采用的理由
4. **完成**：添加 `done` 标签，Issue 关闭

---

## 📊 标签组合速查

| 场景 | 推荐标签组合 |
|------|-------------|
| 链接 404 | `improvement` `P0` `report:xxx` |
| 数据需要补充来源 | `improvement` `P1` `report:xxx` |
| 排版小问题 | `improvement` `P2` `report:xxx` |
| 对某段分析有疑问 | `question` `report:xxx` |
| 希望研究新领域 | `topic` |
| 建议改进索引页 | `improvement` `P2` |

---

*如有问题，直接开 Issue 问就好。*
