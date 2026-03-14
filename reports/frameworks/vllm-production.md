# vLLM 生产部署完全指南

> 发布日期：2026-03-14 | 分类：框架 | 作者：探针

---

## Executive Summary

vLLM 是当前最受欢迎的开源 LLM 推理引擎，以其创新的 PagedAttention 技术和活跃的社区生态著称。本指南从架构原理出发，系统覆盖部署配置、性能调优、多租户管理、监控运维等生产部署的全生命周期。

**核心结论：**
- PagedAttention 通过分页式 KV Cache 管理，将显存利用率提升 2-4 倍
- 生产部署需要系统性调优：批处理参数、内存配置、并行策略
- 多模型和多租户场景通过 Ray Serve 或 K8s 部署方案实现
- 完善的监控体系（Prometheus + Grafana）是稳定运维的基础

---

## 1. 架构与核心优化

### 1.1 PagedAttention 原理

PagedAttention 是 vLLM 的核心创新，灵感来自操作系统的虚拟内存分页机制。

**传统 KV Cache 问题：**
- 预分配最大序列长度的连续显存
- 实际使用量远小于分配量（通常只用 20-40%）
- 显存碎片化严重，无法共享

**PagedAttention 解决方案：**

```
┌─────────────────────────────────────────────┐
│                GPU 显存池                    │
│  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐ │
│  │ B0│ B1│ B2│ B3│ B4│ B5│ B6│ B7│   │   │ │  B = Block
│  └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘ │
│       ↑       ↑               ↑             │
│  ┌────┴───┐  ┌┴──────┐  ┌────┴────┐        │
│  │ Seq A  │  │ Seq B  │  │ Seq C   │        │  Block Table
│  │ [0,3,7]│  │ [1,5]  │  │ [2,4,6,8]│       │
│  └────────┘  └────────┘  └─────────┘        │
└─────────────────────────────────────────────┘
```

**关键优势：**
- **按需分配**：只分配实际需要的 block
- **零碎片**：block 可以不连续，消除内部碎片
- **共享前缀**：多个序列可共享相同前缀的 KV block（如 Beam Search）
- **Copy-on-Write**：需要修改时才复制共享 block

### 1.2 Continuous Batching

Continuous Batching（持续批处理）也称 iteration-level scheduling：

```
传统静态批处理:
请求1: [==========] 完成
请求2: [==================] 完成  
请求3: [============] 完成
GPU 利用率: ████████░░░░░░░░ (低，等待最长请求)

Continuous Batching:
Step 1: [Req1, Req2, Req3]
Step 2: [Req1, Req2, Req4] ← Req3 完成，Req4 加入
Step 3: [Req2, Req4, Req5] ← Req1 完成，Req5 加入
GPU 利用率: ████████████████ (高，始终满载)
```

### 1.3 架构组件

```
┌──────────────────────────────────────────┐
│              API Server                   │
│  (OpenAI-compatible / Raw API)           │
├──────────────────────────────────────────┤
│            AsyncEngine                    │
│  ┌──────────────┐ ┌───────────────────┐  │
│  │  Scheduler    │ │  Tokenizer        │  │
│  │  (Batching)   │ │  (Encoding/Decoding)│ │
│  └──────────────┘ └───────────────────┘  │
├──────────────────────────────────────────┤
│           Model Runner                    │
│  ┌──────────────┐ ┌───────────────────┐  │
│  │  Worker       │ │  KV Cache Manager │  │
│  │  (Model Exec) │ │  (PagedAttention) │  │
│  └──────────────┘ └───────────────────┘  │
├──────────────────────────────────────────┤
│          GPU Memory                       │
│  [Model Weights] [KV Cache Blocks]       │
└──────────────────────────────────────────┘
```

---

## 2. 部署配置与调优

### 2.1 基础部署

```bash
# 最简部署
vllm serve meta-llama/Llama-3.1-8B-Instruct

# 生产推荐配置
vllm serve meta-llama/Llama-3.1-70B-Instruct \
  --host 0.0.0.0 \
  --port 8000 \
  --tensor-parallel-size 4 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --max-num-seqs 256 \
  --enable-chunked-prefill \
  --disable-log-requests
```

### 2.2 关键参数详解

| 参数 | 默认值 | 推荐值 | 说明 |
|------|--------|--------|------|
| `--tensor-parallel-size` | 1 | GPU 数量 | 张量并行度 |
| `--gpu-memory-utilization` | 0.9 | 0.85-0.95 | GPU 显存使用比例 |
| `--max-model-len` | 模型最大 | 按需限制 | 最大序列长度 |
| `--max-num-seqs` | 256 | 128-512 | 最大并发序列数 |
| `--enable-chunked-prefill` | False | True | 分块预填充 |
| `--enable-prefix-caching` | False | True | 前缀缓存 |
| `--swap-space` | 4GB | 4-16GB | CPU swap 空间 |
| `--max-num-batched-tokens` | 8192 | 4096-16384 | 每批最大 token 数 |

### 2.3 性能调优策略

**高吞吐量场景：**
```bash
vllm serve model \
  --max-num-seqs 512 \
  --max-num-batched-tokens 16384 \
  --enable-chunked-prefill \
  --gpu-memory-utilization 0.95 \
  --swap-space 8
```

**低延迟场景：**
```bash
vllm serve model \
  --max-num-seqs 64 \
  --max-num-batched-tokens 4096 \
  --enable-prefix-caching \
  --gpu-memory-utilization 0.90
```

**长上下文场景：**
```bash
vllm serve model \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.95 \
  --swap-space 16 \
  --max-num-seqs 32 \
  --enable-chunked-prefill
```

### 2.4 量化部署

```bash
# AWQ 量化模型
vllm serve TheBloke/Llama-3.1-70B-AWQ --quantization awq

# GPTQ 量化模型
vllm serve TheBloke/Llama-3.1-70B-GPTQ --quantization gptq

# FP8 量化（H100/A100 80GB）
vllm serve meta-llama/Llama-3.1-70B-Instruct \
  --quantization fp8 \
  --kv-cache-dtype fp8
```

---

## 3. 多模型与多租户

### 3.1 多模型部署方案

**方案 A：多实例 + 负载均衡**

```
                    ┌─→ vLLM Instance 1 (Model A)
Client → Nginx/LB ──┼─→ vLLM Instance 2 (Model B)
                    └─→ vLLM Instance 3 (Model C)
```

```nginx
# Nginx 配置示例
upstream model_a {
    server 127.0.0.1:8001;
    server 127.0.0.1:8002;
}
upstream model_b {
    server 127.0.0.1:8003;
}
```

**方案 B：Ray Serve 多模型**

```python
from ray import serve
from vllm import LLM

@serve.deployment(num_replicas=2, ray_actor_options={"num_gpus": 4})
class Llama70B:
    def __init__(self):
        self.llm = LLM(model="meta-llama/Llama-3.1-70B-Instruct", tensor_parallel_size=4)
    
    async def __call__(self, request):
        prompt = await request.json()
        outputs = self.llm.generate([prompt["prompt"]])
        return {"text": outputs[0].outputs[0].text}

@serve.deployment(num_replicas=1, ray_actor_options={"num_gpus": 1})
class Llama8B:
    def __init__(self):
        self.llm = LLM(model="meta-llama/Llama-3.1-8B-Instruct")
    
    async def __call__(self, request):
        prompt = await request.json()
        outputs = self.llm.generate([prompt["prompt"]])
        return {"text": outputs[0].outputs[0].text}

# 部署
app = Llama70B.bind()
serve.run(app, route_prefix="/v1/chat/completions/llama-70b")
```

### 3.2 多租户隔离

**资源隔离策略：**
- 独立 GPU 分配：不同租户使用不同 GPU
- 速率限制：通过 API Gateway 限制每租户 QPS
- 优先级队列：vLLM 支持请求优先级（`priority` 参数）

```python
# 通过 API Gateway（如 Kong）实施租户限流
# 每个租户有独立的 API Key，映射到不同的速率限制

# vLLM 端接收优先级
response = client.chat.completions.create(
    model="llama-70b",
    messages=[...],
    extra_body={"priority": 1}  # 高优先级
)
```

### 3.3 Kubernetes 部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-llama-70b
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vllm-llama-70b
  template:
    metadata:
      labels:
        app: vllm-llama-70b
    spec:
      containers:
      - name: vllm
        image: vllm/vllm-openai:latest
        args:
        - "--model"
        - "meta-llama/Llama-3.1-70B-Instruct"
        - "--tensor-parallel-size"
        - "4"
        - "--gpu-memory-utilization"
        - "0.90"
        ports:
        - containerPort: 8000
        resources:
          limits:
            nvidia.com/gpu: 4
          requests:
            nvidia.com/gpu: 4
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 120
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 60
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: vllm-llama-70b
spec:
  selector:
    app: vllm-llama-70b
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

---

## 4. 监控与运维

### 4.1 Prometheus 指标

vLLM 原生暴露 Prometheus 指标（`--enable-metrics`）：

| 指标名称 | 类型 | 说明 |
|----------|------|------|
| `vllm:num_requests_running` | Gauge | 正在运行的请求数 |
| `vllm:num_requests_waiting` | Gauge | 等待中的请求数 |
| `vllm:gpu_cache_usage_perc` | Gauge | KV Cache 使用率 |
| `vllm:avg_generation_throughput` | Gauge | 平均生成吞吐量 |
| `vllm:e2e_request_latency` | Histogram | 端到端请求延迟 |
| `vllm:time_to_first_token` | Histogram | TTFT 分布 |
| `vllm:time_per_output_token` | Histogram | 每 token 生成时间 |
| `vllm:num_preemptions_total` | Counter | 抢占次数（OOM 前兆） |

### 4.2 Grafana Dashboard

推荐监控面板布局：

```
┌──────────────────┬──────────────────┐
│  Requests        │  GPU Cache       │
│  Running/Waiting │  Usage %         │
├──────────────────┼──────────────────┤
│  Throughput      │  Latency         │
│  (tok/s)         │  (TTFT + TPOT)   │
├──────────────────┼──────────────────┤
│  Token Usage     │  Error Rate      │
│  (input/output)  │  (4xx/5xx)       │
└──────────────────┴──────────────────┘
```

### 4.3 日志配置

```bash
# 日志级别控制
VLLM_LOG_LEVEL=INFO  # DEBUG / INFO / WARNING / ERROR

# 结构化日志（JSON 格式）
VLLM_LOGGING_FORMAT_PATH=/path/to/logging_config.json

# 关闭请求日志（生产环境）
--disable-log-requests
```

### 4.4 常见问题排查

**问题 1：OOM（Out of Memory）**
```
症状：CUDA OOM error / 频繁抢占
排查：
  1. 检查 gpu_memory_utilization 是否过高
  2. 减少 max_num_seqs
  3. 减少 max_model_len
  4. 启用量化
  5. 增加 swap_space
```

**问题 2：高延迟**
```
症状：TTFT > 2s / 生成速度 < 20 tok/s
排查：
  1. 检查排队长度（num_requests_waiting）
  2. 检查 GPU 利用率
  3. 启用 chunked_prefill
  4. 检查是否在进行 swap（频繁 swap 说明显存不足）
  5. 考虑增加 GPU 副本
```

**问题 3：输出质量下降**
```
症状：生成内容异常 / 重复 / 截断
排查：
  1. 检查 max_tokens 是否被截断
  2. 检查量化精度（尝试 FP16 验证）
  3. 确认模型加载正确
  4. 检查 KV Cache dtype 是否匹配
```

**问题 4：模型加载缓慢**
```
症状：启动时间 > 10 分钟
排查：
  1. 使用更快的存储（NVMe SSD）
  2. 设置 VLLM_USE_MODELSCOPE=false 或 true
  3. 启用 --load-format sharded（分片加载）
  4. 检查网络带宽（从 HuggingFace 下载）
```

---

## 5. 高级特性

### 5.1 Speculative Decoding

投机解码使用小模型快速生成候选 token，大模型并行验证：

```bash
vllm serve meta-llama/Llama-3.1-70B-Instruct \
  --speculative-model meta-llama/Llama-3.2-1B-Instruct \
  --num-speculative-tokens 5
```

效果：可提升 1.5-2.5x 吞吐量，对长输出效果更显著。

### 5.2 Prefix Caching

自动缓存共享前缀的 KV Cache，适用于：
- 多用户共享相同系统提示
- 多轮对话中重复的历史上下文
- RAG 应用中的文档前缀

```bash
vllm serve model --enable-prefix-caching
```

### 5.3 Multi-LoRA

支持动态加载多个 LoRA 适配器，无需重启服务：

```bash
vllm serve base-model \
  --enable-lora \
  --lora-modules lora_a=./lora_a lora_b=./lora_b \
  --max-lora-rank 64
```

```python
# 使用指定 LoRA
response = client.chat.completions.create(
    model="base-model",
    messages=[...],
    extra_body={"model": "lora_a"}  # 使用 lora_a 适配器
)
```

---

## 参考来源

1. vLLM 官方文档 — [docs.vllm.ai](https://docs.vllm.ai)
2. PagedAttention 论文 — Kwon et al., "Efficient Memory Management for Large Language Model Serving with PagedAttention", SOSP 2023
3. vLLM GitHub — [github.com/vllm-project/vllm](https://github.com/vllm-project/vllm)
4. vLLM 博客 — [blog.vllm.ai](https://blog.vllm.ai)

---

*本指南基于 vLLM v0.6.x 版本撰写，vLLM 迭代快速，建议关注 GitHub Release Notes 获取最新特性。*
