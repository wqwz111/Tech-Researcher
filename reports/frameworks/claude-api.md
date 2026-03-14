# Anthropic Claude API 深度指南

> 发布日期：2026-03-14 | 分类：框架 | 作者：探针

---

## Executive Summary

Anthropic 的 Claude API 以其卓越的长上下文处理、安全对齐和工具调用能力，在企业级 AI 应用中占据重要地位。本指南深入分析 Claude Messages API 的设计哲学、Tool Use / Computer Use 能力、Prompt Caching 机制、系统提示词最佳实践，并与 OpenAI API 进行对比分析。

**核心结论：**
- Claude Messages API 的设计更简洁直观，system prompt 独立于 messages 数组
- Tool Use 支持并行调用和结构化输出，Computer Use 开启了 GUI 自动化新范式
- Prompt Caching 可将重复前缀的延迟降低 80%、成本降低 90%
- Claude 在长文档分析、代码理解和安全关键场景中表现突出

---

## 1. Messages API 设计

### 1.1 核心架构

Claude Messages API 采用了一种比 OpenAI 更简洁的设计：

```python
import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system="你是一个专业的技术文档翻译助手。",  # 独立字段
    messages=[
        {"role": "user", "content": "请翻译以下段落..."},
        {"role": "assistant", "content": "翻译结果..."},
        {"role": "user", "content": "继续翻译下一段"}
    ]
)
```

**设计特点：**
- **system 独立字段**：不混入 messages 数组，语义更清晰
- **多模态原生支持**：content 可以是字符串或 content block 数组
- **严格的消息交替**：user 和 assistant 消息必须交替（可折叠连续同角色消息）
- **stop_reason 明确**：`end_turn` / `max_tokens` / `stop_sequence` / `tool_use`

### 1.2 多模态输入

```python
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64_image
                }
            },
            {
                "type": "text",
                "text": "描述这张图片的内容"
            }
        ]
    }]
)
```

### 1.3 流式响应

```python
with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "解释什么是量子计算"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

---

## 2. Tool Use 与 Computer Use

### 2.1 Tool Use

Claude 的 Tool Use（工具使用）功能与 OpenAI 的 Function Calling 对应，但设计上有细微差异：

```python
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=[
        {
            "name": "get_weather",
            "description": "获取指定城市的天气信息",
            "input_schema": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "城市名称"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
                },
                "required": ["city"]
            }
        }
    ],
    messages=[{"role": "user", "content": "北京天气怎么样？"}]
)

# 检查 tool_use block
for block in message.content:
    if block.type == "tool_use":
        print(f"调用工具: {block.name}")
        print(f"参数: {block.input}")
```

**Tool Use 流程：**
1. 发送带 `tools` 定义的请求
2. Claude 返回 `tool_use` content block
3. 执行工具并将结果以 `tool_result` 消息发送回
4. Claude 基于结果继续生成

```python
# 第三步：回传工具结果
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    messages=[
        {"role": "user", "content": "北京天气怎么样？"},
        {"role": "assistant", "content": [tool_use_block]},
        {
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tool_use_block.id,
                "content": "北京，晴，25°C"
            }]
        }
    ]
)
```

**关键差异（vs OpenAI Function Calling）：**
- 工具结果通过 user 消息回传（而非 tool 角色）
- 支持 `tool_result` 中的 `is_error` 字段标记工具执行失败
- 自动支持并行工具调用（Claude 3.5+）

### 2.2 Computer Use（计算机使用）

Computer Use 是 Claude 3.5 Sonnet 引入的革命性功能，允许 Claude 直接操作计算机界面。

```python
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=[{
        "type": "computer_20241022",
        "name": "computer",
        "display_width_px": 1920,
        "display_height_px": 1080,
        "display_number": 1
    }, {
        "type": "text_editor_20241022",
        "name": "str_replace_editor"
    }, {
        "type": "bash_20241022",
        "name": "bash"
    }],
    messages=[{"role": "user", "content": "帮我打开浏览器并搜索 'AI news'"}]
)
```

**能力范围：**
- 截图分析：理解屏幕上的内容
- 鼠标操作：点击、滚动、拖拽
- 键盘输入：打字、快捷键
- 代码编辑：通过文本编辑器工具
- Shell 操作：通过 bash 工具

**安全考量：**
- 需要在沙箱环境中运行
- 建议实施人工确认机制
- 对敏感操作（如支付、删除）设置额外验证

---

## 3. Prompt Caching

### 3.1 机制说明

Prompt Caching 是 Anthropic 2024 年推出的重要功能，允许缓存频繁使用的长前缀内容。

```python
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "这里是很长的系统提示词，包含大量上下文信息...",
            "cache_control": {"type": "ephemeral"}  # 启用缓存
        }
    ],
    messages=[{"role": "user", "content": "用户的具体问题"}]
)
```

**核心参数：**
- **缓存类型**：`ephemeral`（临时缓存，TTL 约 5 分钟）
- **最小长度**：1024 tokens（Sonnet）/ 2048 tokens（Opus）
- **成本折扣**：缓存命中时，输入成本降低约 90%
- **延迟改善**：缓存命中时，TTFT 降低约 80%

### 3.2 缓存最佳实践

1. **将稳定内容放在前面**：系统提示词、文档上下文等
2. **标记缓存断点**：在消息历史的关键位置添加缓存标记
3. **监控缓存命中率**：通过响应中的 `cache_creation_input_tokens` 和 `cache_read_input_tokens`

```python
# 响应中的缓存统计
print(f"缓存创建: {message.usage.cache_creation_input_tokens}")
print(f"缓存读取: {message.usage.cache_read_input_tokens}")
print(f"常规输入: {message.usage.input_tokens}")
```

**适用场景：**
- RAG 系统中的文档上下文
- 多轮对话的历史消息
- Agent 系统的固定指令集
- 代码分析中的代码库上下文

---

## 4. 系统提示词最佳实践

### 4.1 结构化系统提示

Claude 对系统提示词的响应质量高度依赖提示词的质量。推荐结构：

```text
## 角色定义
你是一个专业的 [角色]，擅长 [核心能力]。

## 任务描述
你的任务是 [具体目标]。你需要：
1. [步骤 1]
2. [步骤 2]
3. [步骤 3]

## 输出格式
请以 [格式] 输出你的结果。

## 约束条件
- 不要 [禁止行为]
- 必须 [必要条件]
- 如果 [边界情况]，则 [处理方式]

## 示例（可选）
输入: ...
输出: ...
```

### 4.2 Chain of Thought 引导

```text
## 思考方式
在给出最终答案之前，请按以下步骤思考：
1. 首先，分析问题的核心需求
2. 列出所有可能的解决方案
3. 评估每种方案的优缺点
4. 选择最佳方案并解释原因
```

### 4.3 安全与边界控制

Claude 系统提示词中应包含明确的安全边界：

```text
## 安全规则
- 不提供医疗、法律或金融建议
- 不生成可能被用于恶意目的的内容
- 遇到不确定的问题，建议用户咨询专业人士
- 拒绝执行涉及个人隐私信息的操作
```

### 4.4 长上下文优化

Claude 支持高达 200K tokens 的上下文窗口，优化策略：

- **文档分段**：在长文档中插入清晰的分段标记
- **引用标注**：使用 `[Document 1]`、`[Section 2.3]` 等标注来源
- **摘要锚点**：在超长对话中定期生成摘要作为新的起点

---

## 5. 与其他 API 对比

### 5.1 Claude vs OpenAI

| 维度 | Claude API | OpenAI API |
|------|-----------|------------|
| 上下文窗口 | 200K tokens | 128K tokens |
| System Prompt | 独立字段 | messages[0] |
| 工具调用 | Tool Use | Function Calling |
| 计算机操作 | Computer Use ✅ | 不支持 |
| Prompt Caching | 显式标记 | 自动检测 |
| JSON 模式 | `tool_use` | Structured Output |
| 视觉理解 | Claude Vision ✅ | GPT-4V ✅ |
| 语音处理 | 不原生支持 | Whisper + TTS |

### 5.2 选型建议

**选择 Claude 当：**
- 需要处理超长文档（200K 上下文）
- 安全性要求极高（宪法 AI 对齐）
- 需要 Computer Use 能力
- 成本优化需求强（Prompt Caching 利润高）

**选择 OpenAI 当：**
- 需要完整的多模态生态（图像生成、语音）
- 需要 Structured Output（严格 JSON Schema）
- 社区生态和第三方集成更成熟
- 需要 Assistants API 等高级抽象

---

## 参考来源

1. Anthropic 官方文档 — [docs.anthropic.com](https://docs.anthropic.com)
2. Anthropic Prompt Engineering 指南 — [docs.anthropic.com/docs/prompt-engineering](https://docs.anthropic.com/docs/prompt-engineering)
3. Claude API 参考 — [docs.anthropic.com/en/api](https://docs.anthropic.com/en/api)
4. Anthropic Blog — [anthropic.com/news](https://www.anthropic.com/news)

---

*本报告基于 2025 年初的 Claude API 状态撰写，Claude 模型和 API 持续快速迭代，请以官方文档为准。*
