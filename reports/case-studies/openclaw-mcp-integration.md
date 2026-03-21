# OpenClaw + MCP 工具生态实战

> 最后更新: 2026-03-16 | 分类: 案例研究 / 工具集成

---

## Executive Summary

本文以实战视角深入分析 OpenClaw 如何集成 MCP（Model Context Protocol）工具生态。我们从 MCP 协议的核心概念出发（交叉引用已有报告，不重复展开），重点聚焦 OpenClaw 作为 MCP Client 的实现细节、从零搭建 MCP Server 的完整流程、工具编排案例、安全边界以及故障排查与性能优化。

**核心结论**: OpenClaw 通过内置的 MCP Client 和 `mcporter` CLI 工具，实现了与 MCP 生态的深度集成。开发者可以通过 stdio 或 HTTP 两种传输方式连接任意 MCP Server，并将工具能力无缝注入 Agent 的会话上下文。配合 OpenClaw 的技能系统和会话管理，可以构建出强大的多工具 Agent 工作流。

---

## 1. MCP 协议回顾

MCP 协议的核心设计已在我们之前的 [MCP 协议生态深度分析](../tools/mcp-ecosystem.md) 报告中详细展开。本节仅做关键概念回顾，为后续实战内容做铺垫。

**MCP 三大能力层**:

- **Tools** — AI 模型可调用的函数，由 Client 发起调用请求，Server 执行并返回结果
- **Resources** — 可读取的数据上下文，支持 URI 模式访问和变更订阅
- **Prompts** — 预定义的提示模板，支持参数化，帮助标准化常见任务

**传输方式**:

| 传输方式 | 适用场景 | OpenClaw 支持 |
|---------|---------|-------------|
| stdio | 本地工具（子进程通信） | ✅ 原生支持 |
| Streamable HTTP | 远程服务（推荐） | ✅ 通过 mcporter |
| HTTP + SSE（旧版） | 兼容场景 | ✅ 向后兼容 |

> 📖 详细协议分析参见: [MCP 协议生态深度分析](../tools/mcp-ecosystem.md)

---

## 2. OpenClaw 的 MCP Client 实现

### 2.1 架构设计

OpenClaw 采用双通道 MCP Client 架构：**Gateway 内置 Client** 负责持久化连接和工具注册，**mcporter CLI** 提供独立的命令行调用能力。

```mermaid
graph TB
    subgraph OpenClaw["OpenClaw Platform"]
        GW["Gateway (Node.js)"]
        MCPClient["MCP Client Module"]
        SkillLoader["Skill Loader"]
        SessionMgr["Session Manager"]
        AgentRT["Agent Runtime"]
        MCPorter["mcporter CLI"]
        GW --> MCPClient
        GW --> SkillLoader
        GW --> SessionMgr
        SessionMgr --> AgentRT
    end
    subgraph MCPServers["MCP Servers"]
        StdioSrv["stdio Server<br>(local process)"]
        HttpSrv["HTTP Server<br>(remote / Streamable HTTP)"]
    end
    MCPClient -->|"spawn subprocess"| StdioSrv
    MCPClient -->|"HTTP POST"| HttpSrv
    MCPorter -->|"stdio / HTTP"| StdioSrv
    MCPorter -->|"HTTP POST"| HttpSrv
    AgentRT -->|"tool call"| MCPClient
```

### 2.2 Gateway 内置 MCP Client

OpenClaw Gateway 在启动时读取 MCP Server 配置，自动建立连接并注册工具。配置文件位于 `~/.openclaw/config.json` 的 `mcp.servers` 字段：

```json
{
  "mcp": {
    "servers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/docs"],
        "transport": "stdio"
      },
      "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_TOKEN": "${GITHUB_TOKEN}"
        },
        "transport": "stdio"
      },
      "remote-tools": {
        "url": "https://mcp.example.com/mcp",
        "transport": "http",
        "headers": {
          "Authorization": "Bearer ${MCP_API_KEY}"
        }
      }
    }
  }
}
```

**工作流程**:

1. Gateway 启动时扫描 `mcp.servers` 配置
2. 对于 stdio 类型，spawn 子进程并建立 JSON-RPC 通道
3. 对于 HTTP 类型，建立到远程端点的连接
4. 执行 `tools/list` 获取可用工具列表
5. 将工具描述注入 Agent 的 System Prompt
6. Agent 在会话中决定调用工具时，Gateway 转发 `tools/call` 请求

### 2.3 mcporter CLI

`mcporter` 是 OpenClaw 生态中的独立 MCP 客户端工具，支持直接从命令行调用 MCP Server 工具，也用于调试和开发。

```bash
# 列出已配置的 MCP Server
mcporter list

# 查看某个 Server 的工具 Schema
mcporter list filesystem --schema

# 直接调用工具
mcporter call filesystem.read_file path=/home/user/docs/readme.md

# 调用远程 Server
mcporter call https://api.example.com/mcp.search query="MCP protocol"

# 通过 stdio 运行自定义 Server
mcporter call --stdio "node ./my-server.js" my_tool param=value

# JSON 输出（供程序消费）
mcporter call filesystem.list_directory path=/home/user --output json
```

### 2.4 工具注入机制

OpenClaw 将 MCP 工具描述转换为 LLM Function Calling 格式，注入到 Agent 的 System Prompt 中。关键在于工具描述的精确性——Server 端的 `description` 和参数 Schema 直接决定了 LLM 选择工具的准确率。

**工具描述最佳实践**:

```typescript
// 好的工具定义
{
  name: "search_docs",
  description: "在项目文档中搜索关键词。返回匹配的文档片段和文件路径。适用于查找 API 用法、配置说明、故障排查指南。",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索关键词或短语，支持空格分隔的多关键词"
      },
      limit: {
        type: "number",
        description: "返回结果数量，默认 5，最大 20",
        default: 5
      }
    },
    required: ["query"]
  }
}
```

---

## 3. 从零搭建 MCP Server 实战

### 3.1 Node.js 实现（推荐）

使用官方 `@modelcontextprotocol/sdk`，创建一个项目文档搜索 Server：

```bash
mkdir mcp-doc-search && cd mcp-doc-search
npm init -y
npm install @modelcontextprotocol/sdk zod
```

```typescript
// server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const DOCS_DIR = process.env.DOCS_DIR || "./docs";

// 创建 MCP Server 实例
const server = new McpServer({
  name: "doc-search",
  version: "1.0.0",
});

// 注册搜索工具
server.tool(
  "search_docs",
  "在项目文档中搜索关键词，返回匹配的文档片段",
  {
    query: z.string().describe("搜索关键词"),
    limit: z.number().optional().default(5).describe("返回结果数量"),
    file_ext: z.string().optional().describe("文件扩展名过滤，如 .md"),
  },
  async ({ query, limit, file_ext }) => {
    const results: Array<{ file: string; snippet: string; score: number }> = [];
    const keywords = query.toLowerCase().split(/\s+/);

    async function searchDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await searchDir(fullPath);
        } else if (entry.isFile()) {
          if (file_ext && !entry.name.endsWith(file_ext)) continue;
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const lowerContent = content.toLowerCase();
            let score = 0;
            for (const kw of keywords) {
              const idx = lowerContent.indexOf(kw);
              if (idx !== -1) {
                score += 1;
                // 提取上下文片段
                const start = Math.max(0, idx - 80);
                const end = Math.min(content.length, idx + kw.length + 80);
                const snippet = content.slice(start, end).replace(/\n/g, " ");
                results.push({
                  file: path.relative(DOCS_DIR, fullPath),
                  snippet: `...${snippet}...`,
                  score,
                });
              }
            }
          } catch {
            // 跳过无法读取的文件
          }
        }
      }
    }

    await searchDir(DOCS_DIR);

    // 按分数排序，返回 top N
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, limit);

    return {
      content: [
        {
          type: "text",
          text: topResults.length > 0
            ? topResults
                .map((r, i) => `### ${i + 1}. ${r.file} (score: ${r.score})\n${r.snippet}`)
                .join("\n\n")
            : `未找到与 "${query}" 相关的文档`,
        },
      ],
    };
  }
);

// 注册资源：文档目录列表
server.resource(
  "doc-list",
  "docs://list",
  async (uri) => {
    const files: string[] = [];
    async function listDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await listDir(fullPath);
        } else {
          files.push(path.relative(DOCS_DIR, fullPath));
        }
      }
    }
    await listDir(DOCS_DIR);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: files.join("\n"),
        },
      ],
    };
  }
);

// 启动 Server（stdio 传输）
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Doc Search Server running on stdio");
}

main().catch(console.error);
```

**编译与运行**:

```bash
# 编译 TypeScript
npx tsc server.ts --outDir dist --target ES2022 --module NodeNext

# 直接运行（需要 tsx）
npx tsx server.ts

# 通过 OpenClaw 连接测试
mcporter call --stdio "npx tsx ./server.ts" search_docs query="authentication" limit:3
```

### 3.2 Python 实现

使用官方 `mcp` Python SDK：

```bash
pip install mcp
```

```python
# server.py
import os
import glob
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent, Resource

DOCS_DIR = os.environ.get("DOCS_DIR", "./docs")

server = Server("doc-search")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="search_docs",
            description="在项目文档中搜索关键词，返回匹配的文档片段",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词",
                    },
                    "limit": {
                        "type": "number",
                        "description": "返回结果数量，默认 5",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="read_doc",
            description="读取指定文档的完整内容",
            inputSchema={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "相对于文档目录的文件路径",
                    },
                },
                "required": ["path"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "search_docs":
        query = arguments["query"].lower()
        limit = arguments.get("limit", 5)
        results = []

        for filepath in glob.glob(f"{DOCS_DIR}/**/*.md", recursive=True):
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            if query in content.lower():
                idx = content.lower().index(query)
                start = max(0, idx - 80)
                end = min(len(content), idx + len(query) + 80)
                snippet = content[start:end].replace("\n", " ")
                results.append(
                    f"### {os.path.relpath(filepath, DOCS_DIR)}\n...{snippet}..."
                )
            if len(results) >= limit:
                break

        text = "\n\n".join(results) if results else f'未找到与 "{query}" 相关的文档'
        return [TextContent(type="text", text=text)]

    elif name == "read_doc":
        filepath = os.path.join(DOCS_DIR, arguments["path"])
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        return [TextContent(type="text", text=content)]

    raise ValueError(f"Unknown tool: {name}")


@server.list_resources()
async def list_resources() -> list[Resource]:
    files = []
    for filepath in glob.glob(f"{DOCS_DIR}/**/*.md", recursive=True):
        files.append(
            Resource(
                uri=f"file://{filepath}",
                name=os.path.relpath(filepath, DOCS_DIR),
                mimeType="text/markdown",
            )
        )
    return files


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

**运行与测试**:

```bash
# 运行 Server
python server.py

# 通过 mcporter 测试
mcporter call --stdio "python ./server.py" search_docs query="deploy" limit:3
```

### 3.3 HTTP 传输模式（Streamable HTTP）

对于需要远程访问的场景，使用 Streamable HTTP 传输：

```typescript
// http-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

const app = express();
app.use(express.json());

const server = new McpServer({
  name: "remote-doc-search",
  version: "1.0.0",
});

server.tool(
  "search",
  "搜索文档",
  { query: z.string(), limit: z.number().optional().default(5) },
  async ({ query, limit }) => {
    // 搜索逻辑...
    return {
      content: [{ type: "text", text: `Found results for: ${query}` }],
    };
  }
);

// 为每个请求创建独立的 transport（无状态设计）
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // 无状态模式
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3000, () => {
  console.log("MCP HTTP Server running on :3000");
});
```

在 OpenClaw 中配置远程 Server：

```json
{
  "mcp": {
    "servers": {
      "remote-docs": {
        "url": "https://your-server.com/mcp",
        "transport": "http",
        "headers": {
          "Authorization": "Bearer your-token"
        }
      }
    }
  }
}
```

---

## 4. OpenClaw + MCP 工具编排案例

### 4.1 案例一：文档研究工作流

将多个 MCP Server 组合，构建完整的研究工作流：

```mermaid
sequenceDiagram
    participant User
    participant Agent as OpenClaw Agent
    participant FS as Filesystem Server
    participant Search as Brave Search Server
    participant Doc as Doc Search Server
    participant Mem as Memory Server
    User->>Agent: "调研 RAG 最新进展，写入报告"
    Agent->>Search: tools/call brave_web_search query="RAG 2025 latest"
    Search-->>Agent: 搜索结果（5 篇文章摘要）
    Agent->>Doc: tools/call search_docs query="RAG architecture"
    Doc-->>Agent: 内部文档片段
    Agent->>FS: tools/call read_file path="templates/report.md"
    FS-->>Agent: 报告模板内容
    Agent->>Agent: 综合分析 + 生成报告
    Agent->>FS: tools/call write_file path="reports/rag-2025.md"
    FS-->>Agent: 文件写入成功
    Agent->>Mem: tools/call store key="rag-research" value="摘要..."
    Mem-->>Agent: 记忆存储成功
    Agent-->>User: "报告已生成: reports/rag-2025.md"
```

**OpenClaw 配置**:

```json
{
  "mcp": {
    "servers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
        "transport": "stdio"
      },
      "brave-search": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-brave-search"],
        "env": { "BRAVE_API_KEY": "${BRAVE_API_KEY}" },
        "transport": "stdio"
      },
      "doc-search": {
        "command": "npx",
        "args": ["tsx", "./servers/doc-search/server.ts"],
        "env": { "DOCS_DIR": "/workspace/docs" },
        "transport": "stdio"
      },
      "memory": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-memory"],
        "transport": "stdio"
      }
    }
  }
}
```

### 4.2 案例二：数据库查询 + 通知工作流

```json
{
  "mcp": {
    "servers": {
      "postgres": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres"],
        "env": {
          "DATABASE_URL": "postgresql://readonly:pass@localhost:5432/proddb"
        },
        "transport": "stdio"
      },
      "slack": {
        "url": "https://mcp-slack.internal.company.com/mcp",
        "transport": "http",
        "headers": {
          "Authorization": "Bearer ${SLACK_MCP_TOKEN}"
        }
      }
    }
  }
}
```

Agent 会话中用户说: "查询上周订单总额，超过 100 万时通知销售团队"

Agent 自动:
1. 调用 `postgres` Server 的查询工具执行 SQL
2. 判断结果是否超过阈值
3. 调用 `slack` Server 发送通知消息

### 4.3 案例三：代码审查自动化

结合 GitHub MCP Server 和自定义代码分析 Server：

```json
{
  "mcp": {
    "servers": {
      "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" },
        "transport": "stdio"
      },
      "code-review": {
        "command": "python",
        "args": ["./servers/code-review/server.py"],
        "transport": "stdio"
      }
    }
  }
}
```

**工作流**: 用户触发 → Agent 获取 PR diff → 代码分析 Server 审查 → 生成审查意见 → GitHub Server 提交 Review Comment

### 4.4 工具编排策略

OpenClaw Agent 在面对多个可用工具时，采用以下策略进行编排：

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| **顺序调用** | 按依赖关系依次调用 | 数据依赖（先查询再分析） |
| **并行调用** | 同时发起多个独立调用 | 多源数据收集 |
| **条件调用** | 根据上一步结果决定下一步 | 阈值判断、分支逻辑 |
| **迭代调用** | 循环调用直到满足条件 | 分页数据拉取、重试 |

---

## 5. 安全边界与最佳实践

### 5.1 安全架构

```mermaid
graph LR
    subgraph Trusted["可信区域"]
        Agent["OpenClaw Agent"]
        Config["配置文件"]
    end
    subgraph Boundary["安全边界"]
        Auth["认证层<br>(OAuth / Token)"]
        RBAC["权限控制<br>(路径/操作白名单)"]
        Audit["审计日志"]
        Sandbox["沙箱执行<br>(Docker / chroot)"]
    end
    subgraph External["外部 MCP Server"]
        S1["stdio Server<br>(本地)"]
        S2["HTTP Server<br>(远程)"]
    end
    Agent --> Auth
    Auth --> RBAC
    RBAC --> Sandbox
    Sandbox --> S1
    Auth --> S2
    RBAC --> Audit
```

### 5.2 核心安全原则

**原则一：最小权限**

每个 MCP Server 只应获得完成任务所需的最小权限：

```json
{
  "filesystem": {
    "command": "npx",
    "args": [
      "-y", "@modelcontextprotocol/server-filesystem",
      "/workspace/reports"
    ],
    "_comment": "只允许访问 reports 目录，而非整个文件系统"
  }
}
```

**原则二：只读优先**

生产环境中的数据库 Server 应使用只读账号：

```json
{
  "postgres": {
    "env": {
      "DATABASE_URL": "postgresql://readonly_user:pass@prod-db:5432/app"
    }
  }
}
```

**原则三：网络隔离**

远程 MCP Server 应限制网络访问范围：

```bash
# iptables 示例：限制 MCP Server 只能访问特定端口
iptables -A OUTPUT -m owner --uid-owner mcp-user -p tcp --dport 443 -d mcp-internal.company.com -j ACCEPT
iptables -A OUTPUT -m owner --uid-owner mcp-user -j DROP
```

### 5.3 认证与授权

**OAuth 2.1 集成**（MCP 规范推荐）:

```typescript
// 远程 Server 的 OAuth 配置示例
{
  "url": "https://api.company.com/mcp",
  "transport": "http",
  "auth": {
    "type": "oauth2",
    "clientId": "openclaw-agent",
    "tokenUrl": "https://auth.company.com/oauth/token",
    "scopes": ["mcp:read", "mcp:write"]
  }
}
```

**Token 轮换**:

```bash
# 使用 mcporter 管理 OAuth Token
mcporter auth https://api.company.com/mcp --reset
mcporter auth https://api.company.com/mcp
```

### 5.4 安全检查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| Server 来源验证 | 必须 | 只使用官方或可信来源的 MCP Server |
| 依赖锁定 | 必须 | 使用 lockfile 锁定依赖版本 |
| 权限最小化 | 必须 | 限制文件路径、数据库权限、API Scope |
| 网络隔离 | 推荐 | 限制 Server 的出站网络访问 |
| 审计日志 | 推荐 | 记录所有工具调用和返回值 |
| 返回值校验 | 推荐 | 对工具返回内容做异常检测 |
| 速率限制 | 推荐 | 限制工具调用频率 |
| 沙箱执行 | 高安全 | 在 Docker 容器中运行 Server |
| 人工审批 | 高安全 | 敏感操作需用户确认 |

> 📖 详细安全分析参见: [MCP 协议生态深度分析 - 安全风险](../tools/mcp-ecosystem.md#6-安全风险与缓解策略)

---

## 6. 故障排查与性能优化

### 6.1 常见问题排查

#### 问题一：MCP Server 启动失败

**症状**: `mcporter list` 显示 Server 状态为 disconnected

**排查步骤**:

```bash
# 1. 手动运行 Server 看报错
npx -y @modelcontextprotocol/server-filesystem /workspace

# 2. 检查 Node.js 版本
node --version  # 需要 v20+

# 3. 检查环境变量
echo $GITHUB_TOKEN

# 4. 查看 OpenClaw 日志
openclaw gateway logs --follow | grep -i mcp
```

#### 问题二：工具调用返回空结果

**症状**: Agent 调用工具后收到空响应

**排查**:

```bash
# 直接用 mcporter 测试工具
mcporter call --stdio "npx tsx ./server.ts" search_docs query="test" --output json

# 检查 Server 的 stderr 输出
mcporter call --stdio "npx tsx ./server.ts 2>&1" search_docs query="test"
```

#### 问题三：远程 Server 连接超时

**症状**: HTTP MCP Server 响应慢或超时

**排查**:

```bash
# 测试网络连通性
curl -X POST https://your-server.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# 检查 TLS 证书
openssl s_client -connect your-server.com:443
```

#### 问题四：工具描述不准确导致 Agent 选错工具

**症状**: Agent 在应该用工具 A 时调用了工具 B

**解决**: 优化 Server 端的工具 `description` 字段，使其更具体、更区分性：

```typescript
// 差的描述
description: "读取文件"

// 好的描述
description: "读取本地文件的完整文本内容。适用于查看配置文件、代码文件、日志文件的内容。如果只需要搜索关键词，请使用 search_docs 工具。"
```

### 6.2 性能优化

#### 优化一：减少工具描述 Token

当 Server 暴露大量工具时，工具描述会占用大量 System Prompt Token。

```typescript
// 策略：按需注册工具
// Server 端支持 filter 参数
server.tool(
  "list_tools_filtered",
  { category: z.enum(["file", "db", "api"]) },
  async ({ category }) => {
    // 只返回特定类别的工具
  }
);
```

#### 优化二：stdio Server 连接复用

OpenClaw Gateway 默认保持 stdio Server 进程运行，避免每次调用都 spawn 新进程：

```json
{
  "mcp": {
    "servers": {
      "my-server": {
        "command": "node",
        "args": ["./server.js"],
        "transport": "stdio",
        "keepAlive": true,
        "maxIdleMs": 300000
      }
    }
  }
}
```

#### 优化三：批量调用

对于需要多次调用同一工具的场景，考虑在 Server 端实现批量接口：

```typescript
// 批量读取文件
server.tool(
  "read_files_batch",
  "批量读取多个文件的内容",
  {
    paths: z.array(z.string()).describe("文件路径列表"),
  },
  async ({ paths }) => {
    const results = await Promise.all(
      paths.map(async (p) => {
        const content = await fs.readFile(p, "utf-8");
        return { path: p, content };
      })
    );
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);
```

#### 优化四：缓存层

对于不变或变化缓慢的数据，在 Client 端添加缓存：

```typescript
// OpenClaw Skill 中的缓存示例
const toolCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60_000; // 1 分钟

async function cachedToolCall(server: string, tool: string, args: any) {
  const key = `${server}.${tool}:${JSON.stringify(args)}`;
  const cached = toolCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const result = await mcporter.call(`${server}.${tool}`, args);
  toolCache.set(key, { data: result, timestamp: Date.now() });
  return result;
}
```

### 6.3 监控与可观测性

**关键指标**:

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| 工具调用延迟 | 从发起调用到收到结果的时间 | > 5s |
| 工具调用成功率 | 成功调用占总调用的比例 | < 95% |
| Server 可用性 | Server 进程/连接是否存活 | 连续 3 次失败 |
| 工具调用频率 | 每分钟调用次数 | > 100/min |
| Token 消耗 | 工具描述占用的 Token 数 | > 2000 tokens |

**日志配置**:

```bash
# OpenClaw Gateway 开启 MCP 调试日志
OPENCLAW_LOG_LEVEL=debug openclaw gateway start

# 过滤 MCP 相关日志
openclaw gateway logs | grep "MCP\|mcp\|tool"
```

---

## 总结

OpenClaw + MCP 的集成模式为 AI Agent 提供了一种标准化、可扩展的工具接入方式。核心优势在于：

1. **协议标准化** — MCP 的 JSON-RPC 2.0 基础让工具集成不再依赖各厂商私有 API
2. **双通道 Client** — Gateway 内置 Client 处理持久连接，mcporter CLI 提供调试和脚本能力
3. **灵活传输** — stdio 适合本地工具，Streamable HTTP 适合远程服务
4. **安全可控** — 通过路径白名单、只读模式、网络隔离等手段控制安全边界
5. **生态丰富** — 1000+ 开源 MCP Server 覆盖主流开发场景（参考 [mcp.so](https://mcp.so) 服务器目录 [accessed 2025-03-20] / [glama.ai/mcp/servers](https://glama.ai/mcp/servers) [accessed 2025-03-20]）

**建议路径**: 从 stdio + 官方 Server 起步 → 自定义 Server 解决特定需求 → 逐步引入远程 Server 和认证机制 → 构建多 Server 编排工作流。

---

## 参考资料

1. **MCP 官方文档** — [modelcontextprotocol.io](https://modelcontextprotocol.io) — 协议规范与 SDK
2. **MCP Specification** — [spec.modelcontextprotocol.io](https://spec.modelcontextprotocol.io) — 完整协议规范（含 Streamable HTTP）
3. **MCP TypeScript SDK** — [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) — 官方 TS SDK
4. **MCP Python SDK** — [github.com/modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk) — 官方 Python SDK
5. **OpenClaw 文档** — [docs.openclaw.ai](https://docs.openclaw.ai) — OpenClaw 平台文档
6. **OpenClaw mcporter 技能** — [docs.openclaw.ai/tools/mcporter](https://docs.openclaw.ai) — MCP CLI 工具使用指南
7. **Anthropic MCP 公告** — [anthropic.com/news/model-context-protocol](https://www.anthropic.com/news/model-context-protocol) — MCP 发布背景
8. **MCP Server Registry** — [mcp.so](https://mcp.so) / [glama.ai/mcp/servers](https://glama.ai/mcp/servers) — 社区 Server 目录
9. **MCP 协议生态深度分析** — [本项目报告](../tools/mcp-ecosystem.md) — MCP 协议全面分析
10. **OpenClaw 深度使用指南** — [本项目报告](../tools/openclaw-guide.md) — OpenClaw 平台完整指南
