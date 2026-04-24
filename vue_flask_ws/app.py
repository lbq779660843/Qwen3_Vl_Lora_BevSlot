from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import base64
import io
import json
import re
from PIL import Image

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"

# 系统提示词（Ollama Modelfile 的 SYSTEM 指令在这里备份，
# 因为 /api/generate 不走 Modelfile 模板，必须显式传入）
SYSTEM_PROMPT = (
    "你是星汉AI大模型，由武汉爱疆科技团队研发。你具备强大的视觉识别和文本处理能力。"
    "在缺陷检测任务中，请仔细观察图片，找出所有缺陷，以JSON格式返回结果。"
    "每个缺陷必须包含 label（缺陷类型）和 bbox（边界框坐标 [x1, y1, x2, y2]）。"
    "只返回纯JSON，不要有其他文字。"
)

CHAT_SYSTEM_PROMPT = (
    "你是星汉AI大模型，由武汉爱疆科技团队研发。你具备强大的视觉识别和文本处理能力。"
    "请像正常的AI助手一样，用自然流畅的语言回答用户的问题。"
)

def calibrate_bbox(bbox, offset_x=0, offset_y=0):
    # bbox 格式 [x1, y1, x2, y2]
    x1, y1, x2, y2 = bbox
    return [x1 - offset_x, y1 - offset_y, x2 - offset_x, y2 - offset_y]

def extract_defects_from_response(response_text):
    """
    Extract defects from model response text.
    The response can be in various formats.
    """
    defects = []
    try:
        print(f"\n[DEBUG] Raw response text:\n{response_text}\n")
        
        # Method 1: Try to find JSON object with 'defects' key
        print("[DEBUG] Trying method 1: Looking for JSON object with 'defects' key...")
        json_pattern = r'\{[\s\S]*?"defects"[\s\S]*?\}'
        matches = re.findall(json_pattern, response_text)
        
        if matches:
            print(f"[DEBUG] Found {len(matches)} potential matches")
            for idx, match in enumerate(matches):
                try:
                    print(f"[DEBUG] Parsing match {idx + 1}: {match[:100]}...")
                    parsed = json.loads(match)
                    if isinstance(parsed.get('defects'), list):
                        defects = parsed['defects']
                        print(f"[DEBUG] [OK] Method 1 SUCCESS: Extracted {len(defects)} defects")
                        return defects
                except json.JSONDecodeError as e:
                    print(f"[DEBUG] JSON parse error in match {idx + 1}: {e}")
                    continue
        else:
            print("[DEBUG] No matches found for method 1")
        
        # Method 2: Try to extract array of objects
        print("[DEBUG] Trying method 2: Looking for JSON array...")
        array_pattern = r'\[\s*\{[\s\S]*?\}\s*\]'
        matches = re.findall(array_pattern, response_text)
        
        if matches:
            print(f"[DEBUG] Found {len(matches)} potential array matches")
            for idx, match in enumerate(matches):
                try:
                    print(f"[DEBUG] Parsing array {idx + 1}: {match[:100]}...")
                    parsed = json.loads(match)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        # Check if first element looks like a defect
                        first_elem = parsed[0]
                        if 'bbox' in first_elem or 'label' in first_elem:
                            defects = parsed
                            print(f"[DEBUG] [OK] Method 2 SUCCESS: Extracted {len(defects)} defects from array")
                            return defects
                except json.JSONDecodeError as e:
                    print(f"[DEBUG] JSON parse error in array {idx + 1}: {e}")
                    continue
        else:
            print("[DEBUG] No matches found for method 2")
        
        # Method 3: Try to extract entire JSON from response
        print("[DEBUG] Trying method 3: Extracting entire JSON response...")
        try:
            parsed = json.loads(response_text)
            if 'defects' in parsed and isinstance(parsed['defects'], list):
                defects = parsed['defects']
                print(f"[DEBUG] [OK] Method 3 SUCCESS: Extracted {len(defects)} defects from full JSON")
                return defects
        except json.JSONDecodeError:
            print("[DEBUG] Response is not valid JSON")
        
        print(f"[DEBUG] [WARN]  All methods failed. Returning empty defects list.")
        
    except Exception as e:
        print(f"[ERROR] Error extracting defects: {e}")
    
    return defects

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Flask server is running'})

@app.route('/detect_defects', methods=['POST'])
def detect_defects():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400

    image_file = request.files['image']
    prompt = request.form.get('prompt', '')
    
    # Default prompt if not provided
    if not prompt:
        prompt = '请检测这张图片里的缺陷：'

    print(f"\n{'='*60}")
    print(f"[INFO] New detection request")
    print(f"[INFO] Image filename: {image_file.filename}")
    print(f"[INFO] User prompt: {prompt}")
    print(f"{'='*60}")

    # Convert image to base64
    image = Image.open(image_file)
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    print(f"[INFO] Image size: {image.width} x {image.height}")
    print(f"[INFO] Base64 size: {len(img_str)} chars")

    # Use /api/chat instead of /api/generate
    # /api/chat properly injects SYSTEM prompt and respects conversation template
    payload = {
        "model": "xinghan-ai-dify",
        "stream": False,
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": prompt,
                "images": [img_str]
            }
        ]
    }
    ollama_url = OLLAMA_CHAT_URL

    try:
        print(f"[INFO] Sending request to Ollama at {ollama_url}...")
        response = requests.post(ollama_url, json=payload, timeout=120)
        response.raise_for_status()
        result = response.json()
        # /api/chat returns: {"message": {"role": "assistant", "content": "..."}}
        response_text = result.get('message', {}).get('content', '')
        
        print(f"[INFO] Got response from Ollama")
        print(f"[INFO] Response length: {len(response_text)} chars")
        
        # Extract defects from response
        defects = extract_defects_from_response(response_text)
        
        #for d in defects:
        #    if 'bbox' in d:
        #        d['bbox'] = calibrate_bbox(d['bbox'], offset_x=50, offset_y=70)
        
        print(f"[INFO] [STAT] Final result: {len(defects)} defects extracted")
        print(f"{'='*60}\n")
        
        return jsonify({
            'result': response_text,
            'defects': defects,
            'image_size': {
                'width': image.width,
                'height': image.height
            }
        })
    except requests.exceptions.Timeout:
        error_msg = "Ollama request timeout (120s)"
        print(f"[ERROR] {error_msg}")
        return jsonify({'error': error_msg}), 500
    except requests.exceptions.ConnectionError:
        error_msg = "Cannot connect to Ollama. Make sure it's running on localhost:11434"
        print(f"[ERROR] {error_msg}")
        return jsonify({'error': error_msg}), 500
    except requests.exceptions.RequestException as e:
        error_msg = f"Ollama request failed: {str(e)}"
        print(f"[ERROR] {error_msg}")
        return jsonify({'error': error_msg}), 500
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        print(f"[ERROR] {error_msg}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': error_msg}), 500

@app.route('/chat', methods=['POST'])
def chat():
    """纯文本对话接口"""
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400

    message = data['message']
    print(f"\n{'='*60}")
    print(f"[CHAT] New chat request")
    print(f"[CHAT] Message: {message[:100]}...")
    print(f"{'='*60}")

    try:
        # Use /api/chat with system prompt for proper model behavior
        payload = {
            "model": "xinghan-ai-dify",
            "stream": False,
            "messages": [
                {
                    "role": "system",
                    "content": CHAT_SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": message
                }
            ]
        }

        print(f"[CHAT] Sending to Ollama /api/chat...")
        response = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=120)
        response.raise_for_status()
        result = response.json()
        response_text = result.get('message', {}).get('content', '')

        print(f"[CHAT] Got response from Ollama")
        print(f"[CHAT] Response length: {len(response_text)} chars")

        return jsonify({
            'response': response_text,
            'timestamp': data.get('timestamp', None)
        })

    except requests.exceptions.Timeout:
        error_msg = "Chat request timeout (120s)"
        print(f"[CHAT ERROR] {error_msg}")
        return jsonify({'error': error_msg}), 500
    except requests.exceptions.ConnectionError:
        error_msg = "Cannot connect to Ollama. Make sure it's running on localhost:11434"
        print(f"[CHAT ERROR] {error_msg}")
        return jsonify({'error': error_msg}), 500
    except Exception as e:
        error_msg = f"Chat error: {str(e)}"
        print(f"[CHAT ERROR] {error_msg}")
        return jsonify({'error': error_msg}), 500

@app.route('/chat_with_image', methods=['POST'])
def chat_with_image():
    """带图片的对话接口"""
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400

    data = request.form
    message = data.get('message', '请描述这张图片：')
    image_file = request.files['image']

    print(f"\n{'='*60}")
    print(f"[CHAT+IMAGE] New chat with image request")
    print(f"[CHAT+IMAGE] Message: {message}")
    print(f"[CHAT+IMAGE] Image: {image_file.filename}")
    print(f"{'='*60}")

    # Convert image to base64
    image = Image.open(image_file)
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    try:
        payload = {
            "model": "xinghan-ai-dify",
            "stream": False,
            "messages": [
                {
                    "role": "system",
                    "content": CHAT_SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": message,
                    "images": [img_str]
                }
            ]
        }

        print(f"[CHAT+IMAGE] Sending to Ollama /api/chat...")
        response = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=120)
        response.raise_for_status()
        result = response.json()
        response_text = result.get('message', {}).get('content', '')

        print(f"[CHAT+IMAGE] [OK] Got response from Ollama")
        print(f"[CHAT+IMAGE] Response length: {len(response_text)} chars")

        return jsonify({
            'response': response_text,
            'image_size': {
                'width': image.width,
                'height': image.height
            },
            'timestamp': data.get('timestamp', None)
        })

    except requests.exceptions.Timeout:
        error_msg = "Chat with image request timeout (120s)"
        print(f"[CHAT+IMAGE ERROR] {error_msg}")
        return jsonify({'error': error_msg}), 500
    except requests.exceptions.ConnectionError:
        error_msg = "Cannot connect to Ollama. Make sure it's running on localhost:11434"
        print(f"[CHAT+IMAGE ERROR] {error_msg}")
        return jsonify({'error': error_msg}), 500
    except Exception as e:
        error_msg = f"Chat with image error: {str(e)}"
        print(f"[CHAT+IMAGE ERROR] {error_msg}")
        return jsonify({'error': error_msg}), 500

if __name__ == '__main__':
    print("Starting Flask app...")
    app.run(host='127.0.0.1', port=8000, debug=False, threaded=True)