# 开源模型推理框架对比研究

> 发布日期：2026-03-14 | 分类：框架 | 作者：探针

---

## Executive Summary

随着开源大语言模型（LLM）生态的蓬勃发展，推理框架的选择成为部署环节的核心决策。本报告对主流推理框架——vLLM、TGI（Text Generation Inference）、TensorRT-LLM、SGLang 和 Ollama——进行系统性对比，涵盖吞吐量、延迟、量化支持、分布式推理等关键维度。

**核心结论：**
- **vLLM** 是当前最流行的通用推理引擎，PagedAttention 技术显著提升显存利用率
- **SGLang** 在复杂工作负载（如 Agent）中表现优异，RadixAttention 优化 KV Cache 复用
- **TensorRT-LLM** 在 NVIDIA 硬件上达到最高吞吐量，但部署复杂度较高
- **Ollama** 是本地开发和实验的首选，一键部署体验最佳
- **TGI** 适合 HuggingFace 生态用户，与 Hub 深度集成

---

## 1. 框架概览

### 1.1 vLLM

**项目地址**：[github.com/vllm-project/vllm](https://github.com/vllm-project/vllm)
**维护方**：UC Berkeley → vLLM 社区
**许可证**：Apache 2.0
**当前版本**：v0.6.x（截至 2026-03）

vLLM 是目前 GitHub stars 最多的开源推理引擎（40K+），核心创新是 **PagedAttention**——借鉴操作系统分页思想管理 KV Cache，将显存利用率提升 2-4 倍。

**核心特性：**
- PagedAttention：动态 KV Cache 分页管理
- Continuous Batching：持续批处理，最大化 GPU 利用率
- Tensor Parallelism / Pipeline Parallelism：多 GPU 分布式推理
- 量化支持：GPTQ、AWQ、SqueezeLLM、FP8
- Speculative Decoding：投机解码加速
- 多模态支持：LLaVA、Qwen-VL 等

**适用场景：** 通用生产部署，尤其是高并发在线服务。

### 1.2 TGI（Text Generation Inference）

**项目地址**：[github.com/huggingface/text-generation-inference](https://github.com/huggingface/text-generation-inference)
**维护方**：Hugging Face
**许可证**：HFOIL 1.0（部分功能商用需授权）
**当前版本**：v2.4.x（截至 2026-03）

TGI 是 Hugging Face 官方推理服务器，与 HuggingFace Hub 深度集成，开箱即用。

**核心特性：**
- Flash Attention 2 / Paged Attention
- Token Streaming（SSE）
- Continuous Batching
- 量化：GPTQ、AWQ、EETQ、bitsandbytes
- Tensor Parallelism
- 与 Inference Endpoints 无缝集成

**适用场景：** HuggingFace 生态用户，快速原型和中小规模部署。

### 1.3 TensorRT-LLM

**项目地址**：[github.com/NVIDIA/TensorRT-LLM](https://github.com/NVIDIA/TensorRT-LLM)
**维护方**：NVIDIA
**许可证**：Apache 2.0
**当前版本**：v0.12.x（截至 2026-03）

TensorRT-LLM 是 NVIDIA 官方推理优化框架，将模型编译为高度优化的 TensorRT 引擎。

**核心特性：**
- In-flight Batching（类似 Continuous Batching）
- FP8 / INT8 / INT4 量化
- 多 GPU 支持：TP、PP、Expert Parallelism
- Custom CUDA Kernels：深度优化的注意力算子
- Triton Inference Server 集成
- XQA Kernel：为 MQA/GQA 优化的注意力

**适用场景：** NVIDIA GPU 上追求极致性能的生产环境。

### 1.4 SGLang

**项目地址**：[github.com/sgl-project/sglang](https://github.com/sgl-project/sglang)
**维护方**：UC Berkeley
**许可证**：Apache 2.0
**当前版本**：v0.4.x（截至 2026-03）

SGLang 是一个同时提供前端语言（结构化生成语言）和后端推理引擎的框架，核心创新是 **RadixAttention**。

**核心特性：**
- RadixAttention：基于 radix tree 的 KV Cache 自动复用
- 前端语言：结构化提示词编程
- 原生 JSON Schema 约束解码
- Data Parallelism + Tensor Parallelism
- Speculative Decoding
- 量化：GPTQ、AWQ、FP8

**适用场景：** 复杂 LLM 工作负载（Agent、多轮对话、结构化生成）。

### 1.5 Ollama

**项目地址**：[github.com/ollama/ollama](https://github.com/ollama/ollama)
**维护方**：Ollama 团队
**许可证**：MIT
**当前版本**：v0.5.x（截至 2026-03）

Ollama 定位为本地 LLM 运行工具，追求极致的易用性。

**核心特性：**
- 一键安装：`curl -fsSL https://ollama.com/install.sh | sh`
- 模型管理：`ollama pull/run/list/rm`
- Modelfile：自定义模型配置
- REST API：兼容 OpenAI API 格式
- 跨平台：macOS / Linux / Windows

**适用场景：** 本地开发、实验、个人使用。

---

## 2. 吞吐量与延迟对比

### 2.1 基准测试环境

以下数据综合自多个独立基准测试（2024-2025），使用标准配置：

- **硬件**：8× NVIDIA H100 80GB
- **模型**：Llama 3 70B（TP=8）
- **输入长度**：1024 tokens
- **输出长度**：256 tokens
- **并发数**：变化

### 2.2 吞吐量对比（tokens/sec）

| 框架 | 并发=1 | 并发=16 | 并发=64 | 备注 |
|------|--------|---------|---------|------|
| TensorRT-LLM | ~45 | ~520 | ~1,800 | 原始性能最高 |
| vLLM | ~42 | ~480 | ~1,650 | 最佳平衡 |
| SGLang | ~43 | ~500 | ~1,720 | 复杂负载更优 |
| TGI | ~38 | ~420 | ~1,400 | 中规中矩 |
| Ollama | ~35 | N/A | N/A | 单请求场景 |

> ⚠️ 数据为近似值，实际性能受模型、硬件、负载分布等因素影响。
>
> **版本信息**：vLLM v0.6.x | TensorRT-LLM v0.12.x | SGLang v0.4.x | TGI v2.4.x | Ollama v0.5.x
>
> **数据来源**：
> - [Artificial Analysis — LLM Inference Benchmark](https://artificialanalysis.ai/text/arena?tab=Leaderboard)（独立第三方基准测试平台）
> - [vLLM 官方 Benchmark](https://docs.vllm.ai/en/latest/performance/benchmarks.html)
> - [SGLang 官方 Benchmark](https://github.com/sgl-project/sglang#performance)
> - [TensorRT-LLM 官方 Performance Guide](https://nvidia.github.io/TensorRT-LLM/performance/performance-tuning-guide.html)
> - 社区测试（Reddit、GitHub Discussions 等）

### 2.3 首 token 延迟（TTFT）

| 框架 | TTFT（P50） | TTFT（P99） |
|------|------------|------------|
| TensorRT-LLM | ~80ms | ~200ms |
| SGLang | ~90ms | ~250ms |
| vLLM | ~100ms | ~300ms |
| TGI | ~120ms | ~350ms |
| Ollama | ~150ms | ~500ms |

### 2.4 关键发现

1. **TensorRT-LLM 性能最高**，但需预先编译模型引擎，部署时间长
2. **SGLang 在高并发和复杂路由场景**中吞吐量接近 TensorRT-LLM
3. **vLLM 是最佳通用选择**，性能与易用性平衡最好
4. **Ollama 仅适合单请求/低并发场景**，不支持 continuous batching

---

## 3. 量化支持对比

### 3.1 量化方法概述

| 量化方法 | 精度 | 特点 | 显存节省 |
|----------|------|------|----------|
| GPTQ | INT4/INT3 | 校准数据集，高精度 | ~75% |
| AWQ | INT4 | 激活感知，保护重要通道 | ~75% |
| FP8 | FP8 | 无需校准，硬件原生 | ~50% |
| bitsandbytes | INT8/INT4 | 零样本量化 | ~50-75% |
| SqueezeLLM | INT4 | 非均匀量化 | ~75% |

### 3.2 框架量化支持矩阵

| 框架 | GPTQ | AWQ | FP8 | bitsandbytes | INT8 |
|------|------|-----|-----|-------------|------|
| vLLM | ✅ | ✅ | ✅ | ✅ | ✅ |
| TGI | ✅ | ✅ | ❌ | ✅ | ✅ |
| TensorRT-LLM | ✅ | ✅ | ✅ | ❌ | ✅ |
| SGLang | ✅ | ✅ | ✅ | ❌ | ✅ |
| Ollama | ❌ | ❌ | ❌ | ❌ | ✅(Q4_0等) |

> Ollama 使用自己的 GGUF 量化格式（Q4_0, Q4_K_M, Q5_K_M, Q8_0 等），不支持 GPTQ/AWQ。

### 3.3 量化选型建议

- **精度优先**：FP8（需 Ada/Hopper 架构 GPU）或 GPTQ 4-bit
- **通用性**：AWQ 4-bit（精度略优于 GPTQ，速度更快）
- **本地部署**：Ollama + GGUF Q4_K_M（易用性最佳）
- **极致压缩**：GPTQ INT3（精度损失可控但需仔细评估）

---

## 4. 分布式推理

### 4.1 并行策略

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| Tensor Parallelism (TP) | 层内拆分，GPU 间通信频繁 | 单节点多 GPU |
| Pipeline Parallelism (PP) | 层间拆分，通信量低 | 多节点/大模型 |
| Expert Parallelism (EP) | MoE 专家拆分 | Mixtral 等 MoE 模型 |
| Data Parallelism (DP) | 复制模型，处理不同请求 | 提升吞吐量 |

### 4.2 框架分布式能力

| 框架 | TP | PP | DP | EP | 多节点 |
|------|----|----|----|----|--------|
| vLLM | ✅ | ✅ | ✅ | ✅ | ✅ |
| TensorRT-LLM | ✅ | ✅ | ✅ | ✅ | ✅ |
| SGLang | ✅ | ✅ | ✅ | ✅ | ✅ |
| TGI | ✅ | ❌ | ❌ | ❌ | 有限 |
| Ollama | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.3 实践建议

**单节点多 GPU（8×GPU）：**
- 首选 TP=GPU 数量
- vLLM 或 TensorRT-LLM

**多节点大模型（如 405B）：**
- TP + PP 组合
- 推荐 vLLM 或 TensorRT-LLM

**高吞吐需求：**
- DP + TP 组合
- vLLM 的 `--data-parallel-size` 参数

---

## 5. 选型建议

### 5.1 决策矩阵

| 场景 | 推荐框架 | 理由 |
|------|----------|------|
| 通用生产部署 | **vLLM** | 性能与易用性最佳平衡 |
| NVIDIA 极致性能 | **TensorRT-LLM** | 硬件级优化 |
| 复杂 Agent/结构化生成 | **SGLang** | RadixAttention + 前端语言 |
| HuggingFace 生态 | **TGI** | Hub 深度集成 |
| 本地开发/实验 | **Ollama** | 最简部署 |
| MoE 模型 | **vLLM** 或 **TensorRT-LLM** | Expert Parallelism 支持 |

### 5.2 迁移成本评估

| 迁移路径 | 难度 | 说明 |
|----------|------|------|
| vLLM → SGLang | 低 | API 兼容，可直接替换 |
| vLLM → TGI | 低 | OpenAI 兼容 API |
| TGI → vLLM | 低 | OpenAI 兼容 API |
| vLLM → TensorRT-LLM | 高 | 需要模型编译，运维复杂度增加 |
| 任意 → Ollama | 低 | 适合开发环境切换 |

### 5.3 趋势观察

1. **OpenAI 兼容 API** 成为行业标准，所有框架都提供兼容层
2. **FP8 量化**随着 H100/H200 普及正成为主流
3. **Speculative Decoding** 各框架争相支持
4. **多模态推理** 成为新的差异化点
5. **SGLang 增长迅猛**，在复杂工作负载中展现优势

---

## 参考来源

1. vLLM 官方文档 — [docs.vllm.ai](https://docs.vllm.ai) | GitHub: [vllm-project/vllm](https://github.com/vllm-project/vllm)
2. TGI 文档 — [huggingface.co/docs/text-generation-inference](https://huggingface.co/docs/text-generation-inference) | GitHub: [huggingface/text-generation-inference](https://github.com/huggingface/text-generation-inference)
3. TensorRT-LLM 文档 — [nvidia.github.io/TensorRT-LLM](https://nvidia.github.io/TensorRT-LLM) | GitHub: [NVIDIA/TensorRT-LLM](https://github.com/NVIDIA/TensorRT-LLM)
4. SGLang 官方文档 — [sgl-project.github.io](https://sgl-project.github.io) | GitHub: [sgl-project/sglang](https://github.com/sgl-project/sglang)
5. Ollama 官方 — [ollama.com](https://ollama.com) | GitHub: [ollama/ollama](https://github.com/ollama/ollama)
6. Artificial Analysis — LLM Inference Provider Comparison — [artificialanalysis.ai](https://artificialanalysis.ai)
7. vLLM 官方 Benchmark — [docs.vllm.ai/en/latest/performance/benchmarks](https://docs.vllm.ai/en/latest/performance/benchmarks.html)
8. SGLang 性能数据 — [github.com/sgl-project/sglang#performance](https://github.com/sgl-project/sglang#performance)
9. TensorRT-LLM Performance Tuning — [nvidia.github.io/TensorRT-LLM/performance](https://nvidia.github.io/TensorRT-LLM/performance/performance-tuning-guide.html)

---

*本报告基于 2025 年初各框架版本撰写，推理框架领域发展迅速，建议定期查阅各项目 GitHub Release Notes 获取最新信息。*
