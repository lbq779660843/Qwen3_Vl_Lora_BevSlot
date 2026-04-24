# 图像缺陷检测应用

这是一个基于 XingHan AI 视觉语言模型的图像缺陷检测 Web 应用。

## 功能

- 上传图像文件
- 使用 XingHan AI 模型检测图像中的缺陷
- 显示检测结果（JSON 格式）

## 要求

- Python 3.8+
- Node.js 16+
- Ollama 已安装并运行 XingHan AI 模型

## 安装和运行

### 1. 安装后端依赖

```bash
pip install -r requirements.txt
```

### 2. 启动 Flask 后端

```bash
python app.py
```

后端将在 http://localhost:5000 运行。

### 3. 安装前端依赖

```bash
npm install
```

### 4. 启动前端

```bash
npm run dev
```

前端将在 http://localhost:5173 运行。

## 使用方法

1. 确保 Ollama 已启动并加载了 `xinghan-ai` 模型。
2. 打开浏览器访问前端 URL。
3. 选择一个图像文件。
4. 点击"检测缺陷"按钮。
5. 查看检测结果。

## 注意

- 确保 Ollama 服务正在运行在 localhost:11434。
- 图像将被转换为 base64 并发送到 Ollama API。
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
