#!/usr/bin/env python3
import os
import sys

# Change to the correct directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Import and run Flask app
from app import app

if __name__ == '__main__':
    print("Starting Flask server on port 8000...")
    app.run(host='127.0.0.1', port=8000, debug=False, threaded=True)