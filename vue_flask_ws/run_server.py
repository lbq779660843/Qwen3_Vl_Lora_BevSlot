#!/usr/bin/env python
import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Import and run the Flask app
from app import app

if __name__ == '__main__':
    print("Starting Flask server...")
    app.run(host='127.0.0.1', port=8000, debug=False, threaded=True)