# 快速诊断指南

## 问题：测试了若干张图像，都没检测到缺陷

## 🚀 快速排查步骤

### 1️⃣ 确保后端正在运行

检查 Flask 后端的日志。如果看到以下信息，说明后端正常运行：

```
 * Running on http://127.0.0.1:5000
```

### 2️⃣ 查看实时调试信息

现在前端已经添加了 **调试面板**。上传图片后，你会看到：

```
📤 Sending request...
✅ Response received in X.Xs
📊 Defects found: X
```

### 3️⃣ 查看完整的后端日志

在 Flask 运行的终端窗口中查看：

```
============================================================
[INFO] New detection request
[INFO] Image filename: test.jpg
[INFO] Image size: 2048 x 1536
[INFO] Sending request to Ollama...
[INFO] ✅ Got response from Ollama

[DEBUG] Raw response text:
{... model output ...}

[DEBUG] Trying method 1: Looking for JSON object with 'defects' key...
[DEBUG] Trying method 2: Looking for JSON array...
[DEBUG] Trying method 3: Extracting entire JSON response...
[DEBUG] ⚠️  All methods failed. Returning empty defects list.
[INFO] 📊 Final result: 0 defects extracted
============================================================
```

## 🔍 常见原因和解决方案

### 问题 1: 模型返回的格式不是 JSON

**症状**：后端日志显示 "All methods failed"

**可能原因**：
- 模型返回的不是 JSON 格式
- 模型返回了中文错误信息或说明文字

**解决**：
检查模型的返回格式。如果模型总是返回 JSON，但格式与预期不同，需要调整正则表达式。

### 问题 2: 模型没有检测到缺陷

**症状**：模型响应显示 `{"defects": []}`

**可能原因**：
- 图片质量不够好
- 图片中没有缺陷
- 模型需要特定的提示词格式

**解决**：
- 尝试用其他图片测试
- 调整提示词
- 通过 Ollama CLI 直接测试模型

### 问题 3: 无法连接到 Ollama

**症状**：前端显示错误 "Cannot connect to Ollama"

**原因**：
- Ollama 服务未启动
- 模型未加载

**解决**：
```bash
# 启动 Ollama 和加载模型
ollama run xinghan-ai
```

## 📊 数据流诊断

```
用户上传图片
    ↓
前端显示 "📤 Sending request..."
    ↓
Flask 后端接收并转换为 base64
    ↓
调用 Ollama API
    ↓
模型推理返回结果 (查看 "Raw response text:")
    ↓
尝试 3 种方法解析 JSON
    ↓
成功/失败标记
    ↓
前端显示 "✅ Response received" 或 "❌ ERROR"
```

## 🛠️ 快速测试

### 方法 A: 直接通过 Ollama CLI 测试

```bash
ollama run xinghan-ai
>>> 输入图片路径：D:\datasets\20241220\images\aj-image\12_mouse_bite_06.jpg
>>> 请检测这张图片里的缺陷：
```

检查模型是否返回 JSON 格式的缺陷。

### 方法 B: 通过浏览器开发者工具

1. 打开浏览器 DevTools (F12)
2. 切换到 **Network** 标签
3. 上传图片并检测
4. 找到 `/detect_defects` 请求
5. 查看 **Response** 中的 `defects` 字段

### 方法 C: 查看浏览器 Console

按 F12，在 Console 中查看：
```javascript
// 最后一次的响应数据
console.log(lastResponse)
```

## 📝 需要提供的诊断信息

如果问题仍未解决，请复制以下信息：

1. **后端日志**（整个 "=====" 分割的区块）
2. **模型的原始响应**（"Raw response text:" 后的内容）
3. **前端调试面板输出**
4. **测试的图片名称**

## 🔧 临时解决方案

如果模型返回的格式异常，可以临时修改 `extract_defects_from_response()` 函数来适配新格式。

在 `app.py` 中，在所有 3 种方法之后添加：

```python
# Method 4: Custom parsing for your specific model output
# Adapt this based on what the model actually returns
if not defects and 'your_expected_field' in response_text:
    # Your custom parsing logic here
    pass
```

## 检查清单

- [ ] Flask 后端正在运行（`python app.py`）
- [ ] 前端显示调试信息
- [ ] 后端日志显示接收到请求
- [ ] 后端日志显示模型返回了响应
- [ ] 查看 "Raw response text" 中模型的输出格式
- [ ] 确认模型是否成功检测到缺陷
- [ ] 如果检测到缺陷，查看是否成功解析了 JSON
