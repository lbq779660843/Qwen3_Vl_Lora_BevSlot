"""
Debug script to test the defect detection API
"""
import requests
import json
import sys
from pathlib import Path

# Test if backend is running
def test_backend():
    try:
        response = requests.get('http://localhost:5000/health', timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running on http://localhost:5000")
            return True
    except requests.exceptions.ConnectionError:
        print("❌ Backend is not running. Start it with: python app.py")
        return False
    except Exception as e:
        print(f"❌ Error checking backend: {e}")
        return False

def test_detection(image_path):
    """Test defect detection with an image"""
    if not Path(image_path).exists():
        print(f"❌ Image file not found: {image_path}")
        return False
    
    try:
        with open(image_path, 'rb') as f:
            files = {'image': f}
            data = {'prompt': '请检测这张图片里的缺陷：'}
            
            print(f"\n📤 Sending request to detect_defects API...")
            print(f"   Image: {image_path}")
            
            response = requests.post(
                'http://localhost:5000/detect_defects',
                files=files,
                data=data,
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"\n✅ Detection successful!")
                print(f"\n📊 Response structure:")
                print(f"   - Image size: {result.get('image_size')}")
                print(f"   - Defects count: {len(result.get('defects', []))}")
                print(f"\n🎯 Defects detected:")
                if result.get('defects'):
                    for idx, defect in enumerate(result['defects'], 1):
                        print(f"   [{idx}] {defect['label']}: bbox={defect['bbox']}")
                else:
                    print("   No defects found")
                
                print(f"\n📝 Raw model response (first 300 chars):")
                print(f"   {result.get('result', '')[:300]}...")
                
                return True
            else:
                print(f"❌ API returned error: {response.status_code}")
                print(f"   {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Error during detection: {e}")
        return False

if __name__ == '__main__':
    print("🔍 Backend Debug Tool")
    print("=" * 50)
    
    # Test backend connectivity
    if not test_backend():
        sys.exit(1)
    
    # If image path provided, test detection
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        test_detection(image_path)
    else:
        print("\n💡 Usage: python debug_api.py <image_path>")
        print("   Example: python debug_api.py D:\\datasets\\20241220\\images\\aj-image\\12_mouse_bite_06.jpg")
