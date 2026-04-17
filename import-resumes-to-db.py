#!/usr/bin/env python3
"""
Resume Import Script
Import resume files from uploads/resumes folder to server database.
Files should be named in format: 姓名_岗位.扩展名
MBTI will be randomly assigned since these files didn't go through the MBTI screening process.
"""

import os
import sys
import re
import random
import requests
import json
import platform

from pathlib import Path
from datetime import datetime

# Configuration
if platform.system() == 'Windows':
    FOLDER_PATH = r"d:\小孙文件\demo_vscode\LStwinHR-dev_v0.0.3\uploads\resumes"
else:
    FOLDER_PATH = "/home/sunner/trae-pro/LStwinHR-dev_v0.0.3/uploads/resumes"
API_BASE_URL = "http://localhost:3005"
EXTENSIONS = {'.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'}

# Login credentials (modify these)
USERNAME = "admin"
PASSWORD = "admin123"

# Token cache file
TOKEN_CACHE_FILE = r"d:\小孙文件\demo_vscode\LStwinHR-dev_v0.0.3\.token_cache"

# MBTI types
MBTI_TYPES = [
    'INTJ', 'INTP', 'ENTJ', 'ENTP',
    'INFJ', 'INFP', 'ENFJ', 'ENFP',
    'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
    'ISTP', 'ISFP', 'ESTP', 'ESFP'
]

# Standard formats:
# 1. 姓名_岗位.扩展名 (如: 李金昌_数据类管培生.jpg)
# 2. 姓名_岗位_MBTI.扩展名 (如: 唐之尧_数据类管培生_INFJ.doc)
# 支持任意岗位名称，不限于"管培生"结尾
STANDARD_PATTERN = re.compile(r'^([\u4e00-\u9fa5a-zA-Z]+)_([\u4e00-\u9fa5a-zA-Z]+)(?:_[A-Z]{4})?$')

def parse_filename(filename):
    """Parse filename to extract name and position"""
    name = Path(filename).stem
    match = STANDARD_PATTERN.match(name)
    if match:
        return match.group(1), match.group(2)
    return None, None

def random_phone():
    """Generate a random phone number"""
    prefixes = ['138', '139', '136', '137', '158', '159', '188', '189']
    return random.choice(prefixes) + ''.join([str(random.randint(0, 9)) for _ in range(8)])

def random_email(name):
    """Generate a random email based on name"""
    domains = ['qq.com', '163.com', 'gmail.com', 'outlook.com']
    pinyin_map = {
        '丁羽凡': 'dingyufan', '代相龙': 'daixianglong', '唐之尧': 'tangzhiyao',
        '广棹舟': 'guangzhaozhou', '张任飞': 'zhangrenfei', '张家威': 'zhangjiawei',
        '方阳春': 'fangyangchun', '李金昌': 'lijinchang', '江萌': 'jiangmeng',
        '测试': 'test', '陈昕耘': 'chenxinyun', '陈龙': 'chenlong',
        '马梓桓': 'mazihuan'
    }
    base = pinyin_map.get(name, f"user{random.randint(1000, 9999)}")
    return f"{base}{random.randint(1, 999)}@{random.choice(domains)}"

def random_mbti():
    """Return a random MBTI type"""
    return random.choice(MBTI_TYPES)

def get_cached_token():
    """Try to get token from cache"""
    try:
        if os.path.exists(TOKEN_CACHE_FILE):
            with open(TOKEN_CACHE_FILE, 'r') as f:
                data = json.load(f)
                token = data.get('token')
                # Verify token is still valid
                if token:
                    response = requests.get(
                        f'{API_BASE_URL}/api/user/info',
                        headers={'Authorization': f'Bearer {token}'},
                        timeout=10
                    )
                    if response.status_code == 200:
                        print(f"[INFO] Using cached token")
                        return token
    except Exception as e:
        print(f"[WARN] Cache read failed: {e}")
    return None

def save_token_to_cache(token):
    """Save token to cache"""
    try:
        with open(TOKEN_CACHE_FILE, 'w') as f:
            json.dump({'token': token, 'timestamp': datetime.now().isoformat()}, f)
    except Exception as e:
        print(f"[WARN] Cache write failed: {e}")

def login_and_get_token(username=None, password=None):
    """Login and get authentication token"""
    username = username or USERNAME
    password = password or PASSWORD

    # Try cached token first
    cached = get_cached_token()
    if cached:
        return cached

    print(f"[LOGIN] Logging in as {username}...")

    try:
        response = requests.post(
            f'{API_BASE_URL}/api/login',
            json={'username': username, 'password': password},
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print(f"[LOGIN] Login successful!")
                save_token_to_cache(token)
                return token
            else:
                print(f"[ERROR] No token in response")
        else:
            print(f"[ERROR] Login failed: {response.status_code}")
            print(f"        {response.text[:200]}")

    except Exception as e:
        print(f"[ERROR] Login request failed: {e}")

    return None

def import_resumes(token, preview_only=True):
    """Import all resume files to server database"""

    files = []
    for f in Path(FOLDER_PATH).iterdir():
        if f.is_file() and f.suffix.lower() in EXTENSIONS:
            files.append(f)

    print(f"[STAT] Total files found: {len(files)}")
    print()

    # Filter standard format files
    standard_files = []
    for f in files:
        name, position = parse_filename(f.name)
        if name and position:
            standard_files.append((f, name, position))
        else:
            print(f"[SKIP] Non-standard filename: {f.name}")

    print(f"[ANALYSIS] Standard format files: {len(standard_files)}")
    print()

    if preview_only:
        print("=" * 60)
        print("[PREVIEW - Files to import]")
        print("=" * 60)
        for f, name, position in sorted(standard_files, key=lambda x: x[1]):
            mbti = random_mbti()
            phone = random_phone()
            email = random_email(name)
            print(f"  {name} | {position} | {mbti} | {phone} | {email}")
            print(f"    File: {f.name}")
            print(f"    Size: {f.stat().st_size / 1024:.2f} KB")
            print()

        print("=" * 60)
        print(f"[SUMMARY] {len(standard_files)} files ready to import")
        print("=" * 60)
        print()
        print("[INFO] This is PREVIEW mode only.")
        print("       Run with --import to actually import files.")
        return

    # Fetch existing candidates from database to check duplicates
    print("[INFO] Fetching existing candidates from database...")
    try:
        response = requests.get(
            f'{API_BASE_URL}/api/candidates',
            headers={'Authorization': f'Bearer {token}'},
            timeout=30
        )
        existing_candidates = []
        if response.status_code == 200:
            existing_candidates = response.json()
            if isinstance(existing_candidates, list):
                print(f"[INFO] Found {len(existing_candidates)} existing candidates in database")
            else:
                print(f"[WARN] Unexpected response format from API")
        else:
            print(f"[WARN] Failed to fetch existing candidates: {response.status_code}")
    except Exception as e:
        print(f"[WARN] Failed to fetch existing candidates: {e}")
        existing_candidates = []

    # Build a set of existing (name, position) combinations
    existing_set = set()
    for c in existing_candidates:
        if isinstance(c, dict):
            name = c.get('name', '')
            position = c.get('position', '')
            if name and position:
                existing_set.add((name.strip(), position.strip()))

    print(f"[INFO] Existing (name, position) combinations: {len(existing_set)}")
    print()

    # Actual import
    print("=" * 60)
    print("[IMPORT] Starting import...")
    print("=" * 60)
    print()

    success_count = 0
    error_count = 0
    skipped_count = 0
    duplicate_count = 0

    headers = {
        'Authorization': f'Bearer {token}'
    }

    for f, name, position in sorted(standard_files, key=lambda x: x[1]):
        # Check if candidate with same name and position already exists
        if (name.strip(), position.strip()) in existing_set:
            print(f"[SKIP] Already exists in database: {name} | {position}")
            print(f"       File: {f.name}")
            skipped_count += 1
            duplicate_count += 1
            print()
            continue

        try:
            mbti = random_mbti()
            phone = random_phone()
            email = random_email(name)

            print(f"[IMPORT] {name} | {position} | {mbti}")
            print(f"         File: {f.name}")

            # Prepare form data
            data = {
                'name': name,
                'position': position,
                'phone': phone,
                'email': email,
                # 不传递 MBTI，避免生成带 MBTI 后缀的重复文件
                'status': '待分析',
                'submitTime': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }

            # Read file
            with open(f, 'rb') as file_handle:
                files_data = {
                    'resume': (f.name, file_handle, 'application/octet-stream')
                }

                response = requests.post(
                    f'{API_BASE_URL}/api/candidates',
                    headers=headers,
                    data=data,
                    files=files_data,
                    timeout=60
                )

            if response.status_code == 200:
                result = response.json()
                print(f"         [SUCCESS] ID: {result.get('candidate', {}).get('id', 'N/A')}")
                success_count += 1
                # Add to existing set to prevent duplicate import in same run
                existing_set.add((name.strip(), position.strip()))
            elif response.status_code == 409:
                print(f"         [SKIP] Already exists")
                skipped_count += 1
                duplicate_count += 1
            else:
                print(f"         [ERROR] {response.status_code}: {response.text[:100]}")
                error_count += 1

        except Exception as e:
            print(f"         [ERROR] {str(e)}")
            error_count += 1

        print()

    print("=" * 60)
    print("[COMPLETE]")
    print("=" * 60)
    print(f"  Success:            {success_count}")
    print(f"  Skipped (duplicates): {skipped_count}")
    print(f"  Errors:              {error_count}")
    print("=" * 60)
    if duplicate_count > 0:
        print(f"  [NOTE] {duplicate_count} files were skipped because candidates with")
        print(f"         the same name and position already exist in the database.")

def main():
    print("=" * 60)
    print("       Resume Import Tool v1.0")
    print("=" * 60)
    print()

    if len(sys.argv) < 2:
        print("[USAGE]")
        print("  python import-resumes-to-db.py --preview          # Preview files")
        print("  python import-resumes-to-db.py --import           # Import files (auto login)")
        print("  python import-resumes-to-db.py --import <user> <pass>  # Import with credentials")
        print()
        print("[CONFIG] Default credentials in script:")
        print(f"         Username: {USERNAME}")
        print(f"         Password: {PASSWORD}")
        return

    if sys.argv[1] == '--preview':
        import_resumes(None, preview_only=True)
    elif sys.argv[1] == '--import':
        # Get credentials from args or use defaults
        username = sys.argv[2] if len(sys.argv) > 2 else None
        password = sys.argv[3] if len(sys.argv) > 3 else None

        # Login and get token
        token = login_and_get_token(username, password)
        if not token:
            print()
            print("[ERROR] Failed to get authentication token")
            print("        Please check your credentials in the script or provide them as arguments")
            return

        import_resumes(token, preview_only=False)
    else:
        print(f"[ERROR] Unknown option: {sys.argv[1]}")

if __name__ == '__main__':
    main()
