# 大模型微调策略对比研究

## Executive Summary

微调是将通用大模型适配到特定领域的关键手段。本文系统对比 Full Fine-tuning、LoRA、QLoRA、PEFT 等主流微调策略，从数据准备、超参数调优、领域适应到成本权衡，提供可落地的微调决策框架。

---

## 1. 微调策略全景

### 1.1 策略分类

```
微调方法
├── 全参数微调 (Full Fine-tuning)
│   ├── 全精度 (FP32/BF16)
│   └── 分布式 (DeepSpeed/FSDP)
├── 参数高效微调 (PEFT)
│   ├── LoRA / QLoRA
│   ├── Adapter Tuning
│   ├── Prefix Tuning
│   └── Prompt Tuning
└── 强化学习微调
    ├── RLHF (PPO)
    ├── DPO
    └── GRPO
```

### 1.2 核心对比

| 方法 | 可训练参数 | 显存需求 | 训练速度 | 效果 | 适用场景 |
|------|-----------|---------|---------|------|---------|
| Full FT | 100% | 极高 | 慢 | 最佳 | 数据充足、算力充足 |
| LoRA | 0.1-1% | 低 | 快 | 接近全量 | 通用场景首选 |
| QLoRA | 0.1-1% | 极低 | 中 | 略低LoRA | 低资源环境 |
| Adapter | 1-5% | 中 | 中 | 接近全量 | 多任务切换 |
| DPO | 0.1-1% | 中 | 快 | 对齐专用 | 偏好对齐 |

---

## 2. LoRA 系列详解

### 2.1 LoRA 原理

Low-Rank Adaptation：冻结原始权重 W，新增低秩分解矩阵：

```
W' = W + ΔW = W + BA
其中 B ∈ R^(d×r), A ∈ R^(r×k), r << min(d,k)
```

**关键超参数**:
- rank (r): 秩，通常 8-64，越大表达力越强但参数越多
- alpha: 缩放因子，通常 = 2×rank
- target_modules: 应用 LoRA 的层（q_proj, v_proj, k_proj, o_proj）

### 2.2 QLoRA 创新

在 LoRA 基础上引入三项技术：

1. **4-bit NormalFloat (NF4)**: 量化基座模型权重
2. **Double Quantization**: 对量化常数再量化
3. **Paged Optimizers**: 利用 CPU 内存避免 OOM

**显存对比** (7B 模型):
- Full FT (BF16): ~60 GB
- LoRA (BF16): ~20 GB
- QLoRA (4-bit): ~6 GB ✅ 单卡 24GB 可跑

---

## 3. 数据准备与质量控制

### 3.1 数据格式

**指令微调格式**:
```json
{
  "instruction": "将以下英文翻译成中文",
  "input": "Hello, world!",
  "output": "你好，世界！"
}
```

**对话格式 (Chat Template)**:
```json
{
  "messages": [
    {"role": "system", "content": "你是一个翻译助手"},
    {"role": "user", "content": "Hello, world!"},
    {"role": "assistant", "content": "你好，世界！"}
  ]
}
```

### 3.2 数据质量控制

| 检查项 | 方法 | 工具 |
|--------|------|------|
| 去重 | 模糊去重 + 精确去重 | datasketch, nearpy |
| 格式校验 | Schema 验证 | Pydantic, jsonschema |
| 质量过滤 | 分类器 / 启发式规则 | llama-factory |
| 长度分布 | 截断 / 过短过滤 | 自定义脚本 |
| 数据配比 | 领域混合比例 | 人工设计 |

### 3.3 数据量参考

| 场景 | 建议数据量 |
|------|-----------|
| 简单格式转换 | 1K-5K |
| 领域知识注入 | 5K-50K |
| 能力增强（如推理） | 50K-500K |
| 全面能力提升 | 500K+ |

---

## 4. 超参数调优指南

### 4.1 核心超参数

| 参数 | 推荐范围 | 说明 |
|------|---------|------|
| Learning Rate | 1e-5 ~ 5e-4 | LoRA 可用较高 LR |
| Batch Size | 4-32 (梯度累积) | 受显存限制 |
| Epochs | 2-5 | 数据少则多 epochs |
| Warmup Steps | 总步数 3-10% | 预热学习率 |
| LoRA Rank | 8-64 | 越大越强但也越慢 |
| LoRA Alpha | rank × 2 | 缩放因子 |
| Max Length | 512-4096 | 根据任务调整 |

### 4.2 训练策略

```
Phase 1: 小规模实验 (1% 数据, 1 epoch)
  → 确保训练流程通畅
  → 观察 loss 下降趋势

Phase 2: 超参数搜索
  → LR: [1e-5, 5e-5, 1e-4, 5e-4]
  → rank: [8, 16, 32, 64]
  → 小数据集快速对比

Phase 3: 全量训练
  → 最优超参数 + 全数据
  → 监控 eval loss 防过拟合
```

---

## 5. 领域适应最佳实践

### 5.1 分阶段微调

```
通用基座 → 领域继续预训练 (CPT) → 指令微调 (SFT) → 偏好对齐 (DPO)
```

**阶段 1 - 继续预训练**:
- 大量领域文本（如医学文献）
- 用 MLM 或 CLM 目标
- 学习率: 1e-5

**阶段 2 - 指令微调**:
- 高质量指令数据
- 监督学习目标
- 学习率: 2e-4 (LoRA)

**阶段 3 - 偏好对齐**:
- 偏好对比数据
- DPO 或 RLHF
- 学习率: 5e-5

### 5.2 常见陷阱

- **灾难性遗忘**: 领域数据过多导致通用能力下降
  - 解决: 混合通用数据，比例 7:3
- **过拟合**: eval loss 上升
  - 解决: Early stopping + 更多数据
- **格式不一致**: 模型输出格式混乱
  - 解决: 统一 Chat Template + 格式数据增强

---

## 6. 成本与效果权衡

### 6.1 成本对比 (7B 模型)

| 方案 | GPU | 时间 | 成本估算 |
|------|-----|------|---------|
| Full FT (多卡) | 4×A100 80G | 8h | ~$80 |
| LoRA (单卡) | 1×A100 40G | 2h | ~$10 |
| QLoRA (单卡) | 1×RTX 4090 | 4h | ~$4 |
| API 微调 (OpenAI) | 无需GPU | 1h | ~$25 |

### 6.2 决策树

```
是否需要私有部署？
├── 是 → 数据量 > 100K？
│   ├── 是 → Full FT (多卡)
│   └── 否 → LoRA / QLoRA
└── 否 → API 微调 (OpenAI / Claude)
```

---

## 参考来源

1. Hu, E. et al. "LoRA: Low-Rank Adaptation of Large Language Models" (2021) — ICLR 2022
2. Dettmers, T. et al. "QLoRA: Efficient Finetuning of Quantized Language Models" (2023) — NeurIPS 2023
3. Hugging Face PEFT Documentation — https://huggingface.co/docs/peft
4. LLaMA-Factory — https://github.com/hiyouga/LLaMA-Factory
5. Wei, J. et al. "Fine-Tuned Language Models Are Zero-Shot Learners" (2022) — Google Research
