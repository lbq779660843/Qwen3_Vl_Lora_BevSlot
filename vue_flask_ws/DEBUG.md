# 缺陷可视化调试指南

## 问题描述
- ✅ 有检测结果的文字输出
- ❌ Canvas 缺陷可视化为空白

## 调试步骤

### 1️⃣ 检查浏览器控制台日志

1. 打开浏览器（`http://localhost:5173`）
2. 按 `F12` 打开开发者工具，选择 **Console** 标签
3. 上传图片并点击"检测缺陷"
4. 查看控制台输出，应该看到类似的日志：

```
[DEBUG] Drawing defects: (Array of objects)
[DEBUG] Drawing defect 0: label=漏铜, bbox=[1878, 1098, 1948, 1167]
[DEBUG] Drawing defect 1: label=漏铜, bbox=[1575, 1218, 1637, 1286]
...
[DEBUG] Finished drawing 5 defects
```

### 2️⃣ 检查后端日志

在运行 Flask 的终端窗口查看日志：

```
[INFO] Sending request to Ollama...
[INFO] Model response: {"defects": [{"label": "漏铜", "bbox": [...]}]}
[DEBUG] Extracted 5 defects from response
[DEBUG] Defects: [...]
```

### 3️⃣ 常见问题

#### 问题 A: 控制台显示 "No defects to draw"
- **原因**: 后端返回的 `defects` 数组为空或格式错误
- **解决**:
  1. 查看后端是否成功解析模型响应
  2. 运行调试脚本: `python debug_api.py <image_path>`
  3. 检查模型返回的 JSON 格式

#### 问题 B: Canvas 显示但没有边界框
- **原因**: 图片坐标超出 Canvas 范围或图片加载失败
- **检查**:
  1. Canvas 大小是否正确: 检查 `console.log('Canvas:', canvas.width, canvas.height)`
  2. 边界框坐标是否合理: 查看 `[DEBUG] Drawing defect` 日志中的 bbox 值
  3. 图片是否完全加载

#### 问题 C: 后端 JSON 解析失败
- **原因**: 模型响应格式与预期不符
- **检查模型响应格式**:
  1. 运行: `python debug_api.py <image_path>`
  2. 查看 "Raw model response" 部分
  3. 确认格式是否包含 `{"defects": [...]}`

### 4️⃣ 快速调试

#### 使用调试脚本测试后端
```bash
# 基本检查
python debug_api.py

# 测试具体图片
python debug_api.py D:\datasets\20241220\images\aj-image\12_mouse_bite_06.jpg
```

#### 在浏览器中测试 API
在浏览器开发者工具的 Console 中运行:

```javascript
// 获取最后一个检测结果
console.log('Last result:', JSON.parse(localStorage.getItem('lastResult') || '{}'));

// 手动触发 Canvas 重绘
// （前提是已经有检测结果）
```

### 5️⃣ 检查数据流

```
用户上传图片
    ↓
前端发送到 Flask (/detect_defects)
    ↓
Flask 转换为 base64，调用 Ollama
    ↓
Ollama 模型推理，返回结果
    ↓
Flask 解析 JSON，提取 defects
    ↓
前端接收 JSON 响应
    ↓
useEffect 触发，调用 drawDefects()
    ↓
Canvas 绘制边界框
```

### 6️⃣ 更新检查清单

- [ ] 后端日志显示 "Extracted X defects"
- [ ] 浏览器控制台显示 "[DEBUG] Drawing defect" 信息
- [ ] Canvas 宽高正确（应该等于图片尺寸）
- [ ] bbox 坐标值在图片范围内
- [ ] 模型响应包含有效的 JSON 数据

## 核心检查代码

### 后端 (app.py)
- `extract_defects_from_response()`: 从模型响应中提取 defects
- 添加了详细的 `print()` 调试语句

### 前端 (App.tsx)
- `drawDefects()`: 在 Canvas 上绘制边界框
- `useEffect`: 监听 result 变化并触发绘制
- `console.log()`: 输出调试信息

## 快速重启

1. **停止前端**: 在 npm dev 的终端按 `Ctrl+C`
2. **停止后端**: 在 Flask 的终端按 `Ctrl+C`
3. **启动后端**: 
   ```bash
   cd vue_flask_ws
   python app.py
   ```
4. **启动前端**:
   ```bash
   npm run dev
   ```
5. **刷新浏览器**: `http://localhost:5173`

## 需要帮助？

如果问题仍未解决，请提供以下信息：
1. 浏览器控制台的完整日志输出
2. Flask 后端的日志输出
3. 调试脚本的输出结果
4. 使用的测试图片（或其格式/大小信息）
