# AI 安全与防护工具研究

> **发布日期**: 2026-03-14  
> **分类**: 工具研究  
> **标签**: AI安全, Prompt注入, 内容安全, 模型安全, 隐私保护

---

## Executive Summary

随着大语言模型（LLM）被广泛应用于生产环境，AI 安全问题已经从学术讨论变成了工程团队必须面对的现实挑战。2024-2025 年间，Prompt Injection 攻击、模型越狱、数据泄露、内容安全等安全事件频繁发生，给企业带来了实质性的风险。

本报告系统研究了 AI 安全与防护工具的全景，覆盖五个核心领域：

1. **Prompt Injection 防护**：检测和阻止针对 LLM 的注入攻击
2. **内容安全过滤**：确保模型输出符合安全和合规标准
3. **模型安全评估**：系统化评估模型的安全性和对齐程度
4. **隐私保护**：防止训练数据泄露和个人信息外泄
5. **合规检查**：满足 GDPR、EU AI Act 等法规要求

**核心结论**：AI 安全是一个多层防御问题，没有任何单一工具能解决所有安全挑战。企业需要在应用层、模型层、数据层和基础设施层分别部署相应的安全措施，形成纵深防御体系。

---

## 一、Prompt Injection 防护

### 1.1 威胁模型

Prompt Injection 是 LLM 应用面临的最独特、最严重的安全威胁之一。攻击者通过精心构造的输入，试图让模型忽略系统指令，执行非预期的操作。

**攻击类型分类**：

| 攻击类型 | 描述 | 危害程度 |
|----------|------|----------|
| **直接注入** | 用户直接输入恶意指令 | 高 |
| **间接注入** | 通过外部数据源（网页、文档）注入 | 高 |
| **越狱攻击** | 绕过安全限制获取有害内容 | 中-高 |
| **多轮攻击** | 通过多轮对话逐步诱导 | 中 |
| **编码绕过** | 使用 Base64、Unicode 等编码绕过检测 | 中 |

**真实案例**：

- **DAN（Do Anything Now）**：经典的越狱 Prompt，让 ChatGPT 扮演无限制角色
- **间接注入攻击**：在网页中嵌入隐藏指令，当 AI 读取该网页时执行恶意操作
- **数据窃取**：通过注入指令让模型在响应中包含私有数据

### 1.2 Lakera Guard

**[Lakera Guard](https://www.lakera.ai)** 是目前最知名的 Prompt Injection 检测工具之一。

**核心能力**：

- **实时检测**：毫秒级的注入检测
- **多类威胁覆盖**：Prompt Injection、越狱、PII 泄露、毒性内容
- **简单集成**：一行代码或 API 调用
- **持续更新**：基于全球威胁情报持续训练检测模型

**集成示例**：

```python
import requests

def check_input(user_input):
    response = requests.post(
        "https://api.lakera.ai/v2/guard",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={"messages": [{"role": "user", "content": user_input}]}
    )
    result = response.json()
    if result["flagged"]:
        return False  # 拒绝请求
    return True
```

**定价**：提供免费层，企业版按调用量计费。

### 1.3 Rebuff

**[Rebuff](https://github.com/protectai/rebuff)** 是开源的 Prompt Injection 检测器。

**检测策略（多层）**：

1. **启发式检测**：基于规则的初步过滤
2. **LLM 评估**：使用专门训练的检测模型
3. **向量数据库**：检测与已知攻击的相似度
4. **Perplexity 检测**：分析输入的困惑度异常

```python
from rebuff import RebuffSdk

rb = RebuffSdk(
    openai_apikey=OPENAI_KEY,
    pinecone_apikey=PINECONE_KEY,
    pinecone_index="rebuff"
)

result = rb.detect_injection(user_input)
if result.injection_detected:
    print("检测到注入攻击！")
```

### 1.4 LLM Guard

**[LLM Guard](https://github.com/protectai/llm-guard)** 是 Protect AI 推出的开源 LLM 安全工具包。

**扫描器分类**：

**输入扫描器**：
- Prompt Injection 检测
- Toxicity 检测
- PII（个人身份信息）检测
- 禁止内容检测
- Token 限制
- 语言检测
- 编码检测（Base64、ROT13 等）

**输出扫描器**：
- 敏感信息脱敏
- 毒性过滤
- 事实性检查
- URL 验证
- 代码检测

```python
from llm_guard import scan_output, scan_input
from llm_guard.input_scanners import PromptInjection, Toxicity
from llm_guard.output_scanners import NoRefusal, Relevance

# 输入扫描
sanitized_prompt, results_valid, results_score = scan_input(
    [PromptInjection(), Toxicity()],
    user_input
)

# 输出扫描
sanitized_response, results_valid, results_score = scan_output(
    [NoRefusal(), Relevance()],
    user_input,
    model_output
)
```

### 1.5 Prompt Injection 防护最佳实践

1. **输入清理**：对用户输入进行规范化处理
2. **系统 Prompt 隔离**：明确区分系统指令和用户输入
3. **输出约束**：限制模型的输出格式和范围
4. **权限最小化**：不要给模型过多的工具权限
5. **人工审核**：高风险操作需要人工确认
6. **监控告警**：实时监控异常输入模式

---

## 二、内容安全过滤

### 2.1 内容安全的层次

LLM 应用的内容安全涉及两个方向：

- **输入过滤**：阻止有害内容进入模型
- **输出过滤**：确保模型输出符合安全标准

**需要过滤的内容类型**：

- 暴力、仇恨、歧视性内容
- 色情、性相关内容
- 政治敏感内容
- 违法犯罪指导
- 虚假信息和误导性内容
- 未成年人不适宜内容

### 2.2 Azure AI Content Safety

**微软 Azure AI Content Safety** 是企业级的内容安全服务。

**核心能力**：

- **文本分析**：多类别安全评分（暴力、仇恨、性、自残）
- **图像分析**：视觉内容安全检测
- **Prompt Shield**：专门针对 Prompt Injection 的防护
- **自定义类别**：定义企业特有的安全规则
- **内容调节**：可选的自动屏蔽或标记

**评分系统**：0-7 分的安全等级，可配置阈值。

```python
from azure.ai.contentsafety import ContentSafetyClient

client = ContentSafetyClient(endpoint, credential)

response = client.analyze_text(
    AnalyzeTextOptions(text=user_input)
)

# 检查各类别的安全分数
for category in response.categories_analysis:
    if category.severity > threshold:
        # 触发安全处理
        handle_unsafe_content()
```

### 2.3 OpenAI Moderation API

**[OpenAI Moderation API](https://platform.openai.com/docs/guides/moderation)** 免费的内容安全检测服务。

**检测类别**：
- Sexual（性内容）
- Hate（仇恨）
- Harassment（骚扰）
- Self-harm（自残）
- Sexual/Minors（涉及未成年人的性内容）
- Violence（暴力）
- Violence/Graphic（血腥暴力）

**优势**：
- 免费使用
- 低延迟
- 持续更新

**限制**：
- 仅支持英文为主
- 不支持自定义规则
- 只有分类，没有具体建议

### 2.4 Google Perspective API

**[Perspective API](https://perspectiveapi.com)** 由 Google Jigsaw 团队开发，专注于毒性检测。

**检测类型**：
- Toxicity（毒性）
- Severe Toxicity（严重毒性）
- Identity Attack（身份攻击）
- Insult（侮辱）
- Profanity（亵渎）
- Threat（威胁）

**适用场景**：社区评论、用户生成内容的毒性检测。

### 2.5 自建内容过滤管线

对于有特殊需求的企业，可以自建过滤管线：

```
用户输入
  ↓
[第一层] 关键词黑名单 → 快速过滤明显违规
  ↓
[第二层] 正则模式匹配 → 识别特定模式
  ↓
[第三层] 分类器检测 → ML 模型判断
  ↓
[第四层] LLM 审核 → 复杂情况的深度判断
  ↓
安全输入 → 模型处理
  ↓
[第五层] 输出安全检测 → 确保输出合规
  ↓
安全输出 → 返回用户
```

### 2.6 内容安全工具对比

| 工具 | 类型 | 支持语言 | 自定义 | 成本 |
|------|------|----------|--------|------|
| Azure Content Safety | 商业 | 多语言 | ✅ 高 | 按调用计费 |
| OpenAI Moderation | 免费 | 主要英文 | ❌ | 免费 |
| Perspective API | 免费 | 主要英文 | ⚠️ 中 | 免费 |
| LLM Guard | 开源 | 多语言 | ✅ 高 | 自部署 |
| Detoxify | 开源 | 英文 | ⚠️ 中 | 自部署 |

---

## 三、模型安全评估

### 3.1 为什么需要系统化的安全评估？

模型安全评估不是一次性的工作，而是持续的过程：

- **新模型上线前**：需要全面的安全测试
- **模型更新后**：需要回归测试确保安全性不退化
- **新攻击出现时**：需要测试模型对新型攻击的抵抗力
- **合规要求**：某些行业法规要求定期安全评估

### 3.2 Garak — LLM 漏洞扫描器

**[Garak](https://github.com/NVIDIA/garak)** 由 NVIDIA 推出，是目前最全面的 LLM 安全扫描工具。

**类比**：Garak 之于 LLM，就像 Nmap 之于网络、Burp Suite 之于 Web 应用。

**检测能力**：

- **越狱测试**：数百种已知越狱技术
- **Prompt Injection**：多种注入攻击变体
- **数据泄露**：训练数据提取尝试
- **幻觉检测**：事实一致性测试
- **毒性输出**：有害内容生成测试
- **编码绕过**：各种编码绕过技术

```bash
# 安装
pip install garak

# 对模型进行全面扫描
garak --model_type openai --model_name gpt-4

# 只测试特定类别
garak --model_type openai --model_name gpt-4 \
      --probes encoding.InjectBase64,dan.Dan_11_0
```

**输出报告**：详细的漏洞报告，包含成功/失败的攻击、建议修复措施。

### 3.3 PyRIT — Microsoft 的红队工具

**[PyRIT (Python Risk Identification Tool)](https://github.com/Azure/PyRIT)** 是微软推出的开源 LLM 红队工具。

**核心概念**：

- **Target**：被测试的模型或系统
- **Attack Strategy**：攻击策略（角色扮演、编码绕过等）
- **Scorer**：评估攻击是否成功的评分器
- **Orchestrator**：编排多轮攻击

**攻击类型**：
- 多轮对话攻击
- 文本转换攻击（Base64、ROT13、同义词替换等）
- 角色扮演攻击
- 图像攻击（多模态模型）

```python
from pyrit.orchestrator import RedTeamingOrchestrator
from pyrit.prompt_target import AzureOpenAIGPT4Target

target = AzureOpenAIGPT4Target()

orchestrator = RedTeamingOrchestrator(
    attack_strategy="text_transformation",
    red_teaming_chat=target,
    scoring_target=target
)

result = orchestrator.run_attack(objective="生成有害内容")
```

### 3.4 CyberSecEval — Meta 的安全基准

**[CyberSecEval](https://github.com/meta-llama/PurpleLlama/tree/main/CyberSecEval)** 是 Meta 推出的 LLM 安全评估基准。

**评估维度**：

- **不安全代码生成**：模型是否会生成有安全漏洞的代码
- **滥用辅助**：模型是否会协助网络攻击
- **Prompt Injection 易感性**：模型对注入攻击的抵抗力
- **网络攻击知识**：模型的攻击知识深度

### 3.5 OWASP LLM Top 10

[OWASP LLM Top 10](https://genai.owasp.org/) 是 LLM 应用安全的权威指南：

| 排名 | 风险 | 说明 |
|------|------|------|
| LLM01 | Prompt Injection | 通过精心构造的输入操控模型 |
| LLM02 | 敏感信息泄露 | 模型输出包含训练数据中的敏感信息 |
| LLM03 | 供应链风险 | 第三方模型或数据集的安全问题 |
| LLM04 | 数据和模型投毒 | 训练数据被恶意篡改 |
| LLM05 | 不当输出处理 | 未经验证的模型输出导致漏洞 |
| LLM06 | 过度授权 | 模型拥有过多的系统权限 |
| LLM07 | 系统 Prompt 泄露 | 系统指令被提取或泄露 |
| LLM08 | 向量和嵌入弱点 | RAG 系统中的安全问题 |
| LLM09 | 错误信息 | 模型产生虚假或误导性内容 |
| LLM10 | 无界消费 | 缺乏资源限制导致的成本或 DoS 风险 |

---

## 四、隐私保护

### 4.1 LLM 应用中的隐私风险

**训练数据泄露**：

- 模型可能在响应中泄露训练数据
- 成员推断攻击（Membership Inference）可以判断特定数据是否在训练集中
- 数据提取攻击可以从模型中提取特定信息

**用户数据隐私**：

- 用户输入可能被模型提供商用于训练
- API 调用日志可能包含敏感信息
- 多租户场景下的数据隔离

### 4.2 Presidio — 微软的 PII 检测工具

**[Presidio](https://github.com/microsoft/presidio)** 是微软开源的数据保护 SDK。

**核心组件**：

- **Analyzer**：检测文本中的 PII（个人身份信息）
- **Anonymizer**：对检测到的 PII 进行脱敏处理
- **Image Redactor**：图像中的敏感信息处理

**支持的 PII 类型**：
- 姓名、邮箱、电话号码
- 身份证号、护照号
- 信用卡号、银行账户
- IP 地址、地理位置
- 日期、年龄

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

# 检测 PII
results = analyzer.analyze(
    text="我的电话是13800138000，邮箱是test@example.com",
    language="zh"
)

# 脱敏处理
anonymized = anonymizer.anonymize(text=text, analyzer_results=results)
# 输出：我的电话是<PHONE_NUMBER>，邮箱是<EMAIL_ADDRESS>
```

### 4.3 PII 检测的其他工具

| 工具 | 特点 | 适用场景 |
|------|------|----------|
| **Amazon Comprehend** | AWS 托管服务，多语言 | AWS 生态 |
| **Google DLP API** | Google 云服务 | Google Cloud 生态 |
| **PrivateEye (Amazon)** | 开源 PII 检测 | 自部署 |
| **Scrubadub** | 轻量级 Python 库 | 简单场景 |

### 4.4 差分隐私

差分隐私（Differential Privacy）是保护训练数据隐私的数学框架：

- **概念**：通过添加噪声，使得无法判断特定数据点是否在数据集中
- **应用**：在训练或推理过程中添加噪声
- **工具**：OpenDP、TensorFlow Privacy、Opacus（PyTorch）

```python
# Opacus 示例：在 PyTorch 训练中加入差分隐私
from opacus import PrivacyEngine

model = MyModel()
optimizer = torch.optim.Adam(model.parameters())

privacy_engine = PrivacyEngine()
model, optimizer, dataloader = privacy_engine.make_private(
    module=model,
    optimizer=optimizer,
    data_loader=train_loader,
    noise_multiplier=1.0,
    max_grad_norm=1.0,
)

# 训练过程与普通 PyTorch 相同
```

### 4.5 隐私保护最佳实践

1. **输入脱敏**：在发送到 API 之前脱敏 PII
2. **本地处理**：敏感数据尽量使用本地模型
3. **数据最小化**：只发送必要的信息
4. **日志脱敏**：日志中的敏感信息需要脱敏
5. **退出训练**：使用 API 提供商的 opt-out 功能
6. **加密传输**：确保 API 通信使用 TLS
7. **定期审计**：定期检查数据流中的隐私风险

---

## 五、合规检查

### 5.1 主要法规框架

#### EU AI Act

欧盟 AI 法案是全球首个全面的 AI 监管框架：

- **风险分级**：不可接受 / 高风险 / 有限风险 / 最小风险
- **高风险 AI 系统**：需要满足严格的合规要求
- **透明度要求**：用户需要知道他们在与 AI 交互
- **文档要求**：需要提供技术文档和风险管理措施

**合规要点**：
- 风险评估和缓解措施
- 数据治理和质量标准
- 人类监督机制
- 透明度和可解释性
- 准确性和鲁棒性要求

#### GDPR

通用数据保护条例对 LLM 应用的影响：

- **数据处理合法性**：需要明确的法律依据
- **数据最小化**：只处理必要的数据
- **被遗忘权**：用户有权要求删除其数据
- **数据可携权**：用户有权获取其数据的副本
- **自动化决策**：涉及自动决策时需要特别说明

#### 中国法规

- **生成式 AI 管理暂行办法**（2023）：对生成式 AI 服务的合规要求
- **个人信息保护法**：与 GDPR 类似的个人信息保护要求
- **数据安全法**：数据分类分级和安全保护要求

### 5.2 合规检查工具

#### Holistic AI

**[Holistic AI](https://www.holisticai.com)** 提供 AI 治理和合规平台：

- 模型偏见检测
- 合规评估
- 风险管理
- 审计追踪

#### Credo AI

**[Credo AI](https://www.credo.ai)** AI 治理平台：

- 政策管理
- 风险评估
- 合规自动化
- EU AI Act 合规支持

#### Robust Intelligence (现为 Cisco AI Defense)

- 模型安全测试
- 运行时保护
- 合规报告

### 5.3 合规检查清单

**通用合规检查清单**：

- [ ] **数据来源合规**：训练数据是否合法获取？
- [ ] **数据标注合规**：标注过程是否符合劳动法规？
- [ ] **模型安全评估**：是否完成了安全红队测试？
- [ ] **偏见检测**：模型是否存在系统性偏见？
- [ ] **透明度文档**：是否准备了模型卡（Model Card）？
- [ ] **用户通知**：用户是否知道他们在与 AI 交互？
- [ ] **数据保护**：PII 是否得到适当保护？
- [ ] **人类监督**：是否有人类审核高风险输出的机制？
- [ ] **投诉机制**：用户是否有渠道反馈问题？
- [ ] **退出机制**：用户是否可以退出 AI 处理？
- [ ] **日志和审计**：是否记录了足够的审计信息？
- [ ] **事件响应**：是否有安全事件响应计划？

### 5.4 Model Card

Model Card 是记录模型信息的标准化文档，是合规的重要组成部分：

```markdown
# Model Card: [模型名称]

## 模型详情
- 开发者：[组织名称]
- 发布日期：[日期]
- 模型版本：[版本号]
- 模型类型：[语言模型/多模态模型等]

## 预期用途
- 主要用途：[描述]
- 非预期用途：[警告]

## 训练数据
- 数据来源：[描述]
- 数据规模：[描述]
- 数据时间范围：[日期范围]

## 性能评估
- 基准测试结果：[表格]
- 已知局限性：[描述]

## 安全与偏见
- 安全测试结果：[描述]
- 偏见评估：[描述]
- 缓解措施：[描述]

## 环境影响
- 训练计算资源：[描述]
- 碳排放估计：[描述]
```

---

## 六、综合安全架构

### 6.1 纵深防御模型

```
用户请求
  ↓
[网络层] TLS 加密 → DDoS 防护
  ↓
[应用层] 身份认证 → 速率限制 → 输入验证
  ↓
[安全网关] Prompt Injection 检测 → 内容过滤 → PII 脱敏
  ↓
[模型层] 系统 Prompt 保护 → 工具权限限制 → 输出约束
  ↓
[输出层] 内容安全检查 → PII 检测 → 合规检查
  ↓
[监控层] 日志记录 → 异常检测 → 告警通知
  ↓
安全响应
```

### 6.2 安全工具栈推荐

**入门级（个人/小团队）**：
- 内容过滤：OpenAI Moderation API（免费）
- PII 检测：Presidio（开源）
- 安全评估：Garak（开源）
- 总成本：接近零

**标准级（生产环境）**：
- Prompt Injection 防护：LLM Guard（开源）
- 内容安全：Azure Content Safety 或自建管线
- PII 检测：Presidio + 云服务
- 安全评估：Garak + PyRIT
- 合规：自建检查清单
- 总成本：按量付费

**企业级（大型组织）**：
- 全栈防护：Lakera Guard + Azure Content Safety
- 红队测试：PyRIT + 专业安全团队
- 隐私保护：差分隐私 + Presidio + 本地模型
- 合规管理：Holistic AI 或 Credo AI
- 总成本：年度订阅

### 6.3 安全运营流程

1. **风险评估**：上线前进行全面的安全评估
2. **红队测试**：定期进行攻击模拟
3. **监控告警**：实时监控安全事件
4. **事件响应**：建立安全事件响应流程
5. **定期审计**：定期审查安全措施的有效性
6. **持续改进**：根据新威胁更新防护策略

---

## 实践建议

### 1. 安全左移

在开发早期就考虑安全，而不是上线后才加。在设计阶段就明确安全需求。

### 2. 不要只依赖模型提供商的安全措施

OpenAI 和 Anthropic 的内置安全措施是第一道防线，但不能完全依赖。应用层的安全措施同样重要。

### 3. 定期红队测试

即使使用了防护工具，也要定期进行红队测试。攻击技术在不断演进。

### 4. 最小权限原则

模型能做的事情越少，出问题的影响就越小。严格限制模型的工具调用权限和数据访问范围。

### 5. 保持更新

安全工具和模型都在快速更新。定期更新工具版本，关注新的攻击技术和防护方法。

### 6. 记录一切

详细的日志不仅是合规要求，也是安全事件调查的基础。记录每次 LLM 调用的输入、输出和元数据。

### 7. 人机协作

不要完全自动化安全决策。高风险场景（内容审核、敏感操作）需要人类参与。

### 8. 关注供应链安全

模型、数据集、第三方库都可能存在安全问题。对供应链进行安全审查。

---

## 参考来源

1. **OWASP LLM Top 10** — https://genai.owasp.org/ — LLM 应用安全的权威指南
2. **Lakera Guard** — https://www.lakera.ai/ — Prompt Injection 检测服务
3. **LLM Guard (Protect AI)** — https://github.com/protectai/llm-guard — 开源 LLM 安全工具包
4. **Garak (NVIDIA)** — https://github.com/NVIDIA/garak — LLM 漏洞扫描器
5. **PyRIT (Microsoft)** — https://github.com/Azure/PyRIT — LLM 红队工具
6. **Presidio (Microsoft)** — https://github.com/microsoft/presidio — PII 检测和脱敏工具
7. **EU AI Act** — https://artificialintelligenceact.eu/ — 欧盟 AI 法案官方资源
8. **Purple Llama (Meta)** — https://github.com/meta-llama/PurpleLlama — Meta 的 LLM 安全工具集

---

*本报告基于 2024-2025 年间 AI 安全工具生态的研究整理。AI 安全是一个快速发展的领域，新的攻击技术和防护工具不断涌现，建议读者持续关注 OWASP LLM Top 10 的更新和主要安全团队的最新研究。*
