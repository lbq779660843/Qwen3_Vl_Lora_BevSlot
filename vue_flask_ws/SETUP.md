# 缺陷检测应用 - 安装与运行指南

这是一个基于 **XingHan AI VL 8B** 模型的缺陷检测应用，使用 React 前端 + Flask 后端架构。

## 项目结构

```
vue_flask_ws/
├── app.py                 # Flask 后端 API
├── requirements.txt       # Python 依赖
├── package.json          # Node.js 依赖
├── src/
│   ├── App.tsx          # React 主组件（核心UI逻辑）
│   ├── App.css          # 样式表
│   └── ...
└── vite.config.ts       # Vite 配置
```

## 前置要求

### 1. 启动 Ollama 服务

确保 Ollama 服务已启动，模型 `xinghan-ai` 已加载：

```bash
# 在命令行中运行
ollama run xinghan-ai
```

默认 Ollama API 监听在 `http://localhost:11434`

### 2. Python 环境

```bash
# 安装 Python 依赖
pip install -r requirements.txt
```

**依赖包括：**
- Flask：Web 框架
- Flask-CORS：跨域支持
- Pillow：图像处理
- requests：HTTP 请求

### 3. Node.js 环境

```bash
# 安装 Node.js 依赖
npm install
```

## 运行应用

### 步骤 1: 启动 Flask 后端

```bash
# 在项目根目录
python app.py
```

输出示例：
```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

### 步骤 2: 启动 React 前端开发服务器

```bash
# 新开一个终端窗口
npm run dev
```

输出示例：
```
  VITE v8.0.1  ready in 123 ms

  ➜  Local:   http://localhost:5173/
```

### 步骤 3: 打开浏览器

访问 `http://localhost:5173` 即可使用应用。

## 应用功能

### 1. 上传图片
- 选择包含缺陷的 PCB 或电子产品图片
- 支持常见图像格式（JPG, PNG, GIF 等）

### 2. 自动检测
- 将图片发送到 Flask 后端
- 后端调用 Ollama 中的 XingHan AI 模型进行推理
- 模型返回缺陷的位置和类型

### 3. 可视化展示
- **原始图像**：显示上传的原图
- **缺陷统计**：表格显示每个缺陷的类型和坐标
- **缺陷标注**：在 Canvas 上绘制红色边界框，标记缺陷位置和编号

### 返回数据格式

模型返回的 JSON 结构：
```json
{
  "defects": [
    {
      "label": "漏铜",
      "bbox": [x1, y1, x2, y2]
    },
    {
      "label": "漏铜",
      "bbox": [x1, y1, x2, y2]
    }
  ]
}
```

- `label`：缺陷类型
- `bbox`：边界框坐标 [x1, y1, x2, y2]（左上角和右下角）

## API 端点

### POST /detect_defects

**请求：**
```
Content-Type: multipart/form-data

image: <image file>
prompt: "请检测这张图片里的缺陷："
```

**响应：**
```json
{
  "result": "模型原始响应文本...",
  "defects": [
    {
      "label": "缺陷类型",
      "bbox": [x1, y1, x2, y2]
    }
  ],
  "image_size": {
    "width": 2048,
    "height": 1536
  }
}
```

## 故障排除

### 1. 连接 Ollama 失败
- **问题**: `Connection refused` 或 `Failed to detect defects`
- **解决**: 确保 Ollama 服务已启动
  ```bash
  ollama run xinghan-ai
  ```

### 2. CORS 错误
- **问题**: 前端无法调用后端 API
- **解决**: Flask 已配置 CORS，确保后端正在运行

### 3. 模型不正确
- **问题**: 返回结果格式错误或无法解析
- **解决**: 检查模型是否正确加载
  ```bash
  ollama list  # 查看已加载模型
  ```

## 开发和构建

### 开发模式
```bash
npm run dev
```

### 生产构建
```bash
npm run build
```

输出文件在 `dist/` 目录。

### 代码检查
```bash
npm run lint
```

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | ^19.2.4 | 前端框架 |
| Vite | ^8.0.1 | 构建工具 |
| TypeScript | ~5.9.3 | 类型检查 |
| Flask | 最新 | 后端框架 |
| Ollama | - | 模型推理引擎 |

## 许可

此项目基于 XingHan AI 模型，遵循相关许可协议。

## 联系方式

如有问题或建议，请联系开发团队。
