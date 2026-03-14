# 推理增强技术全景分析

## Executive Summary

大模型推理能力的提升是 AI 进步的核心战场。从 Chain-of-Thought 到 Tree-of-Thought，从 Self-Consistency 到 Process Reward Models，本文全景式梳理推理增强技术的演进路线，分析各方法的原理、优劣和适用场景，并展望 Test-Time Compute 等前沿方向。

---

## 1. Chain-of-Thought 及其变体

### 1.1 基础 CoT

**核心思想**: 让模型"一步一步想"，将推理过程显式化。

```
Q: 一个商店有 23 个苹果，卖了 17 个，又进了 6 个，现在有多少个？

CoT: 
步骤1: 初始有 23 个苹果
步骤2: 卖了 17 个，剩余 23 - 17 = 6 个
步骤3: 又进了 6 个，现有 6 + 6 = 12 个
答案: 12 个苹果
```

**效果**: 在 GSM8K（数学推理）上准确率从 17.9% → 58.1%

### 1.2 Zero-shot CoT

在问题后加 "Let's think step by step" 即可触发推理，无需示例。

### 1.3 Few-shot CoT

提供带推理过程的示例：

```
示例1: [问题] → [推理步骤] → [答案]
示例2: [问题] → [推理步骤] → [答案]
问题: [新问题] → ?
```

### 1.4 Auto-CoT

自动生成 CoT 示例：
1. 对问题进行聚类
2. 每类选一个代表性问题
3. 用 Zero-shot CoT 生成推理链
4. 作为 Few-shot 示例

---

## 2. Tree-of-Thought (ToT)

### 2.1 核心思想

将推理从线性链扩展为树状搜索：

```
         [问题]
        /  |  \
     [思路1] [思路2] [思路3]
     / \      |      / \
  [细化] [细化] [细化] [细化] [细化]
   ↓评估   ↓评估   ↓评估   ↓评估   ↓评估
  [最优路径选择]
```

### 2.2 与 CoT 对比

| 维度 | CoT | ToT |
|------|-----|-----|
| 搜索方式 | 贪心（单链） | 树搜索（多分支） |
| 回退能力 | ❌ 不能回退 | ✅ 可回溯 |
| 计算成本 | 1次前向 | 多次前向 |
| 适用问题 | 简单推理 | 复杂规划、创意 |
| 实现复杂度 | 低 | 高 |

### 2.3 关键组件

- **思维分解**: 将问题拆为可独立探索的子问题
- **思维评估**: 用 LLM 评估每个思路的可行性（投票或打分）
- **搜索算法**: BFS（广度优先）或 DFS（深度优先）

---

## 3. Graph-of-Thought (GoT)

### 3.1 核心思想

进一步泛化为图结构，允许思路之间的**合并、循环和交叉引用**：

```
[思路A] → [思路B] → [合并] → [最终答案]
    ↘       ↗
     [思路C]
```

### 3.2 优势

- 支持思路聚合（多个部分解合并）
- 支持循环优化（迭代改进）
- 比 ToT 更灵活的拓扑结构

### 3.3 适用场景

- 复杂问题分解与重组
- 多方案综合
- 迭代优化问题

---

## 4. Self-Consistency 与 Self-Refine

### 4.1 Self-Consistency

**原理**: 对同一问题采样多次推理路径，取多数投票结果。

```
采样1: 推理链A → 答案 X
采样2: 推理链B → 答案 X
采样3: 推理链C → 答案 Y
采样4: 推理链D → 答案 X
采样5: 推理链E → 答案 X

最终答案: X (4/5 票)
```

**效果**: GSM8K 准确率从 58.1% (CoT) → 74.4% (SC)

**缺点**: 计算成本 = 采样数 × 单次推理成本

### 4.2 Self-Refine

**原理**: 迭代改进，生成 → 反馈 → 优化循环：

```
1. 初始回答: [模型生成]
2. 自我反馈: [模型批评自己的回答]
3. 精炼回答: [基于反馈改进]
4. 重复 2-3 直到满意
```

**优势**: 无需外部监督，自我迭代提升
**劣势**: 可能陷入局部最优

---

## 5. Process Reward Models (PRM)

### 5.1 vs Outcome Reward Models (ORM)

| 类型 | 评估时机 | 信号粒度 | 训练数据 |
|------|---------|---------|---------|
| ORM | 最终答案 | 粗（对/错） | 容易获取 |
| PRM | 每个推理步骤 | 细（步骤对错） | 需要标注 |

### 5.2 PRM 训练

1. 采样大量推理路径
2. 标注每一步的正确性
3. 训练模型预测步骤质量
4. 在搜索中用 PRM 引导

### 5.3 应用

```
MATH 问题 → 多条推理路径
    ↓ PRM 评分每一步
    ↓ 选最高分路径
    → 正确率显著提升
```

---

## 6. Test-Time Compute

### 6.1 核心思想

与其花更多钱训练大模型，不如在推理时投入更多计算。

**代表工作**: OpenAI o1/o3 系列

```
传统: 训练时大算本 → 推理时快速输出
o1: 适中训练成本 → 推理时深度思考
```

### 6.2 实现策略

1. **长链推理**: 生成超长推理链（数千 token）
2. **搜索 + 验证**: 多路径搜索 + PRM 引导
3. **自我验证**: 生成答案后自我检验
4. **迭代优化**: 多轮改进直到收敛

### 6.3 Scaling Law

```
模型性能 = f(训练算力, 推理算力)

发现: 在相同总成本下，
      训练小模型 + 推理时多算 > 训练大模型 + 快速推理
```

### 6.4 对比

| 模型 | 训练成本 | 推理成本 | MATH 准确率 |
|------|---------|---------|------------|
| GPT-4 | 极高 | 低 | ~50% |
| o1-mini | 中 | 中 | ~70% |
| o1 | 高 | 高 | ~83% |
| o3 | 高 | 极高 | ~88% |

---

## 7. 技术选型建议

| 场景 | 推荐方法 | 理由 |
|------|---------|------|
| 简单推理 | CoT (Zero-shot) | 简单高效 |
| 数学/逻辑 | CoT + Self-Consistency | 效果好 |
| 复杂规划 | Tree-of-Thought | 支持回溯 |
| 需要高准确率 | PRM + 搜索 | 细粒度引导 |
| 成本敏感 | o1-mini | 性价比最优 |
| 极限性能 | o3 + PRM | 不计成本 |

---

## 参考来源

1. Wei, J. et al. "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models" (2022) — Google, NeurIPS 2022
   - https://arxiv.org/abs/2201.11903
2. Yao, S. et al. "Tree of Thoughts: Deliberate Problem Solving with Large Language Models" (2023) — Princeton
   - https://arxiv.org/abs/2305.10601
3. Besta, M. et al. "Graph of Thoughts: Solving Elaborate Problems with Large Language Models" (2023) — ETH Zurich
   - https://arxiv.org/abs/2308.09687
4. Wang, X. et al. "Self-Consistency Improves Chain of Thought Reasoning in Language Models" (2023) — Google
   - https://arxiv.org/abs/2303.11366
5. Lightman, H. et al. "Let's Verify Step by Step" (2023) — OpenAI
   - https://arxiv.org/abs/2305.20050
6. OpenAI. "Learning to Reason with LLMs" (2024) — o1 System Card
   - https://openai.com/index/learning-to-reason-with-llms/
7. Muennighoff, N. et al. "s1: Simple Test-Time Scaling" (2025) — Stanford
   - https://arxiv.org/abs/2501.19393
8. DeepSeek-AI. "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning" (2025)
   - https://arxiv.org/abs/2501.12948
9. Snell, C. et al. "Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters" (2024) — Google DeepMind
   - https://arxiv.org/abs/2408.03314
10. Setlur, A. et al. "Rewarding Progress: Scaling Automated Process Verifiers for LLM Reasoning" (2024) — Stanford
    - https://arxiv.org/abs/2410.08146
