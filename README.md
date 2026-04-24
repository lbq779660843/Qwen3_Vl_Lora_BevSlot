# Qwen3-VL-8B 车位 BBox 检测模型 — 训练与部署(流程以及验证demo都是Claude Code编写的)

## 环境

- **GPU**: 2×RTX 4090 (24GB)
- **OS**: Windows 11 + WSL2
- **基础模型**: Qwen/Qwen3-VL-8B-Instruct
- **微调任务**: BEV 图像车位 bbox 检测
- **输出格式**: `{"车位": [[x1, y1, x2, y2], ...]}`
- **Docker 镜像**:
  - 训练: `hiyouga/llamafactory:latest`
  - 推理: `vllm/vllm-openai:nightly-fe9c3d6c5f66c873d196800384ed6880687b9e52`

---

## 一、微调训练

### 训练数据格式

```json
{
  "messages": [
    {"role": "user", "content": "<image>\nLocate all parking slots in this BEV image and output the bounding box coordinates in JSON format."},
    {"role": "assistant", "content": "{\"parking_slots\": [[154, 297, 277, 470], [292, 29, 405, 178], [346, 57, 461, 206], [212, 321, 335, 499]]}"}
  ],
  "images": ["/app/data/images/train-image/1720802090182000.jpg"]
}
```

### 启动 LLamaFactory 容器

```bash
docker exec -it llamafactory_webui bash
```

### 训练命令

```bash
CUDA_VISIBLE_DEVICES=0,1 llamafactory-cli train \
    --stage sft \
    --do_train True \
    --model_name_or_path Qwen/Qwen3-VL-8B-Instruct \
    --preprocessing_num_workers 16 \
    --finetuning_type lora \
    --template qwen3_vl_nothink \
    --flash_attn auto \
    --dataset_dir /app/data \
    --dataset bev_parking \
    --cutoff_len 1024 \
    --learning_rate 5e-5 \
    --num_train_epochs 1 \
    --max_samples 126536 \
    --per_device_train_batch_size 1 \
    --gradient_accumulation_steps 8 \
    --lr_scheduler_type cosine \
    --logging_steps 5 \
    --save_steps 200 \
    --warmup_steps 100 \
    --output_dir /app/saves/Qwen3-VL-8B-Instruct/bev_lora_unfrozen_grounding \
    --bf16 True \
    --quantization_bit 4 \
    --quantization_method bnb \
    --plot_loss True \
    --trust_remote_code True \
    --optim paged_adamw_32bit \
    --lora_rank 16 \
    --lora_alpha 32 \
    --lora_target all \
    --freeze_vision_tower True \
    --freeze_multi_modal_projector False \
    --image_max_pixels 501760 \
    --gradient_checkpointing True \
    --ddp_find_unused_parameters False \
    --ddp_timeout 18000
```

**关键参数说明**:

| 参数 | 值 | 说明 |
|------|-----|------|
| `finetuning_type` | lora | LoRA 微调 |
| `lora_rank` | 16 | LoRA 秩 |
| `lora_alpha` | 32 | LoRA scaling |
| `freeze_vision_tower` | True | 冻结视觉编码器 |
| `quantization_bit` | 4 | QLoRA 4-bit 量化 |
| `template` | qwen3_vl_nothink | 去除 thinking 标签 |

### 导出合并模型

将 LoRA 权重合并到基础模型，导出为完整的 safetensors 格式：

```bash
CUDA_VISIBLE_DEVICES=0 llamafactory-cli export \
    --model_name_or_path /app/data/models/Qwen3-VL-8B-Instruct \
    --adapter_name_or_path /app/saves/Qwen3-VL-8B-Instruct/bev_lora_unfrozen_grounding \
    --template qwen3_vl_nothink \
    --finetuning_type lora \
    --export_dir /app/data/models/Qwen3-VL-8B-Merged-bbox \
    --export_size 5 \
    --export_device cpu \
    --export_legacy_format False
```

导出后的模型位于 `D:/datasets/20241220/models/Qwen3-VL-8B-Merged-bbox/`，包含 4 个 safetensors 分片，总计 ~16.5GB。

---

## 二、vLLM 推理部署

### 1. 启动服务

> **注意**: 必须在 WSL2 终端中执行。在 Git Bash 或 CMD 中运行会因路径转换导致卷挂载失败。

```bash
wsl  # 进入 WSL2 终端

docker run -d \
  --name qwen3-vl-bbox \
  --gpus all \
  --ipc host \
  -p 8001:8000 \
  -v /mnt/d/datasets/20241220/models/Qwen3-VL-8B-Merged-bbox:/model \
  vllm/vllm-openai:nightly-fe9c3d6c5f66c873d196800384ed6880687b9e52 \
  --model /model \
  --dtype bfloat16 \
  --tensor-parallel-size 2 \
  --gpu-memory-utilization 0.90 \
  --max-model-len 16384 \
  --max-num-seqs 32 \
  --host 0.0.0.0 \
  --port 8000
```

**参数说明**:

| 参数 | 说明 |
|------|------|
| `--dtype bfloat16` | 与训练精度一致 |
| `--tensor-parallel-size 2` | 跨两张 4090 分布式加载 |
| `--gpu-memory-utilization 0.90` | 90% 显存用于模型 + KV cache |
| `--max-model-len 16384` | 最大上下文长度 |
| `--max-num-seqs 32` | 最大并发序列数 |
| `-p 8001:8000` | 宿主机 8001 映射容器内 8000 |

### 2. 等待加载

模型加载约需 **4 分钟**（权重加载 ~130s + torch.compile ~50s）。

```bash
docker logs -f qwen3-vl-bbox
```

看到以下输出表示就绪：

```
INFO:     Application startup complete.
```

### 3. 验证

```bash
curl http://localhost:8001/v1/models
```

---

## 三、推理测试

### Python 脚本（含可视化）

```python
from openai import OpenAI
import base64
import json
import re
import cv2

client = OpenAI(base_url="http://localhost:8001/v1", api_key="none")

image_path = "/mnt/d/datasets/20241220/images/test-image/5550scan_000098.jpg"

with open(image_path, "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

resp = client.chat.completions.create(
    model="/model",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            {"type": "text", "text": "检测图中的车位，输出bbox坐标。"},
        ],
    }],
    max_tokens=512,
    temperature=0.0,
)

result = resp.choices[0].message.content
print(result)

# 解析 JSON
match = re.search(r'\{.*\}', result, re.DOTALL)
if match:
    data = json.loads(match.group())
    bboxes = data.get("车位", [])
else:
    bboxes = []

# 画框并保存
img = cv2.imread(image_path)
for x1, y1, x2, y2 in bboxes:
    cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

output_path = image_path.replace(".jpg", "_result.jpg")
cv2.imwrite(output_path, img)
print(f"已保存到 {output_path}")
```

### curl 调用

```bash
B64=$(base64 -w 0 test_image.jpg)

curl http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"/model\",
    \"messages\": [{
      \"role\": \"user\",
      \"content\": [
        {\"type\": \"image_url\", \"image_url\": {\"url\": \"data:image/jpeg;base64,${B64}\"}},
        {\"type\": \"text\", \"text\": \"检测图中的车位，输出bbox坐标。\"}
      ]
    }],
    \"max_tokens\": 512,
    \"temperature\": 0.0
  }"
```

### 输出示例

```json
{"车位": [[546, 519, 732, 824], [424, 537, 610, 844], [292, 558, 467, 866], [150, 583, 324, 889], [472, 0, 622, 204]]}
```

bbox 格式为 `[x1, y1, x2, y2]`（左上角 → 右下角）。

---

## 四、日常管理

```bash
docker logs -f qwen3-vl-bbox   # 查看日志
docker stop   qwen3-vl-bbox    # 停止
docker start  qwen3-vl-bbox    # 启动
docker rm -f  qwen3-vl-bbox    # 删除
```

---

## 五、常见问题

### 卷挂载失败

在 Git Bash 或 CMD 中运行 `docker run` 会因路径自动转换导致挂载失败（报错 `Repo id must be in the form...`）。**必须在 WSL2 终端中使用 `/mnt/d/...` 路径格式执行。**

### 端口冲突

修改 `-p` 参数，如 `-p 8002:8000`，调用时 base_url 对应改为 `http://localhost:8002/v1`。
