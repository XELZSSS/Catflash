<div align="center">
  <img src="assets/icons/app.png" alt="Catflash" width="96" height="96" />
  <h1>Catflash</h1>
</div>

Catflash 是一款 Windows 桌面聊天应用，支持多家模型供应商与可选搜索增强，适合日常对话与检索辅助。

## 🚀 核心功能
- 多模型供应商切换与模型配置
- 可选搜索增强（搜索引擎）
- 会话自动保存、搜索与排序

## 🧱 技术栈
- Electron + Vite + React
- TypeScript
- Tailwind CSS
- OpenAI SDK / Google GenAI SDK
- Express 代理

## 🤝 支持的供应商
- Gemini
- OpenAI
- OpenAI-Compatible
- xAI
- DeepSeek
- GLM
- MiniMax
- Moonshot
- iFlow

## ⚡ 快速开始
1. 安装依赖
```
npm install
```

2. 启动开发模式
```
npm run electron:dev
```

如仅需前端：
```
npm run dev
```

## 🧭 基本使用
1. 打开设置，选择供应商并填写 API Key
2. 可按需开启“搜索引擎”并配置 Tavily Key
3. 新建对话后即可开始聊天

## ⚙️ 配置说明
- API Key：必须填写，否则无法请求模型
- 模型：可填写供应商支持的模型名
- Base URL / 自定义 Header：仅 OpenAI-Compatible 需要
- 搜索引擎：可选，用于搜索增强

## 🧰 常用脚本
- 开发：`npm run electron:dev`
- 构建：`npm run build`
- Windows 打包：`npm run electron:build:win`
- 代码检查：`npm run lint`
- 格式化：`npm run format`

## 🗂️ 目录结构
```
apps/main      Electron 主进程
apps/renderer  前端界面
apps/server    本地代理
assets/icons   应用图标
```

## ⚠️ 注意事项
- 本项目主要面向本地使用，API Key 会在本地保存
- 搜索增强需要额外的 Tavily Key