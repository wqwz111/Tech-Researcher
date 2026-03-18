#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const TPL_PATH = path.join(__dirname, '../reports/2026-03-14-mobile-ai-agent.html');
const tpl = fs.readFileSync(TPL_PATH, 'utf8');
const styleMatch = tpl.match(/<style>([\s\S]*?)<\/style>/);
const css = styleMatch ? styleMatch[1] : '';
const scriptMatch = tpl.match(/<script>([\s\S]*?)<\/script>/);
const js = scriptMatch ? scriptMatch[1] : '';

function convertMdToHtml(mdPath, htmlPath) {
  const md = fs.readFileSync(mdPath, 'utf8');
  const title = md.match(/^#\s+(.+)$/m)?.[1] || 'Report';
  let processed = md.replace(/```mermaid\n([\s\S]*?)\n```/g, (_, code) => 
    '<div class="mermaid">' + code.trim() + '</div>'
  );
  const body = marked.parse(processed);
  const html = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script>${js}<\/script>
<style>${css}</style>
</head>
<body>
<div class="container">
${body}
</div>
<div class="footer">
  🔬 由探针 (Probe) 研究 · 🎨 调色板 (Palette) 设计<br>
  <span style="font-size:0.75rem">Generated with OpenClaw Agent</span>
</div>
</body>
</html>`;
  fs.writeFileSync(htmlPath, html);
  const mermaidCount = (html.match(/class="mermaid"/g) || []).length;
  console.log(`✅ ${path.basename(htmlPath)}: ${html.length} bytes, ${mermaidCount} mermaid`);
}

const args = process.argv.slice(2);
if (args.length === 0) { console.log('用法: node md2html.js <file.md> [file2.md ...]'); process.exit(1); }
for (const mdPath of args) { convertMdToHtml(mdPath, mdPath.replace(/\.md$/, '.html')); }
