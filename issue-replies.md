# Issue 修复回复

## Issue #59 — fine-tuning-strategies benchmark 数据补来源

**回复内容**:
```
## ✅ 已完成修复

**修复内容**:
1. **补充 benchmark 数据来源** — Section 7 所有数据表格已添加来源链接:
   - C-Eval → C-Eval Leaderboard (2023-2024)
   - HumanEval → Chen et al. (2021) arXiv:2107.03374
   - GSM8K → Cobbe et al. (2021) arXiv:2110.14168
   - AlpacaEval → AlpacaEval Leaderboard (2024)
   - MedQA → Jin et al. (2020) arXiv:1909.01846
   - DPO vs RLHF 数据补充 Rafailov et al. (NeurIPS 2023) 引用
   - 成本估算补充定价来源说明（OpenAI 定价页 2024 年价格）
2. **修正章节编号** — 8.2 决策树（原错误编号 6.2）
3. **同步更新 HTML**

**文件**: `reports/methodology/fine-tuning-strategies.md` + `.html`
```

---

## Issue #64 — observability-tools 补 OpenTelemetry GenAI

**回复内容**:
```
## ✅ 已完成修复

**修复内容**:
1. **补充 OpenTelemetry GenAI 语义约定** — 新增 1.7 节，覆盖:
   - GenAI 语义约定核心属性（gen_ai.system, gen_ai.request.model, gen_ai.usage.* 等 9 类）
   - 为什么重要（标准化/可移植性/生态兼容/成本归因）
   - 工具支持现状（OpenLLMetry, OpenInference, LangFuse, LangSmith, Datadog, Grafana）
   - 典型集成代码示例
2. **更新工具列表** — 增加 OpenInference (Arize 维护)
3. **补充 3 条参考来源** — OpenTelemetry GenAI Spec, OpenLLMetry, OpenInference
4. **同步更新 HTML**

**文件**: `reports/tools/observability-tools.md` + `.html`
```

---

## Issue #66 — rag-production 确认选型有效性

**回复内容**:
```
## ✅ 已完成修复

**修复内容**:
1. **向量数据库更新** — 标注截至 2026-03 的版本号:
   - Pinecone serverless, Weaviate v1.25+, Qdrant v1.10+, Milvus v2.4+
   - pgvector v0.7+ (HNSW), ChromaDB v0.5+ (生产稳定性改进)
2. **嵌入模型更新** — 增加 Cohere embed-v3, Jina Embeddings v3
   - 添加 MTEB Leaderboard 链接供读者追踪最新排名
3. **框架更新** — LangChain v0.3+, LlamaIndex v0.11+, 增加 Haystack v2.x 和 DSPy v2.4+
4. **评估工具更新** — RAGAS v0.2+, DeepEval v2.x, 增加 TruLens v1.x
5. **文档处理工具** — 增加 Unstructured, DocTR 链接, Amazon Textract
6. **全部引用带 URL + 版本号 + 验证日期**
7. **同步更新 HTML**

**文件**: `reports/case-studies/rag-production.md` + `.html`
```
