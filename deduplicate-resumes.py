#!/usr/bin/env python3
"""
Resume Deduplication Script - Strict Version
Only keeps files in format: "姓名_岗位.扩展名"
Deletes ALL other files (including those with _未测MBTI, timestamps, etc.)
"""

import os
import sys
import re
import platform
from pathlib import Path

if platform.system() == 'Windows':
    FOLDER_PATH = r"d:\小孙文件\demo_vscode\LStwinHR-dev_v0.0.3\uploads\resumes"
else:
    FOLDER_PATH = "/home/sunner/trae-pro/LStwinHR-dev_v0.0.3/uploads/resumes"
EXTENSIONS = {'.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'}

# Standard format: 姓名_岗位.扩展名 (no extra suffixes)
STANDARD_PATTERN = re.compile(r'^[\u4e00-\u9fa5a-zA-Z]+_[\u4e00-\u9fa5a-zA-Z]+管培生$')

def is_standard_filename(filename):
    """Check if filename matches standard format: 姓名_岗位"""
    name = Path(filename).stem
    return bool(STANDARD_PATTERN.match(name))

def analyze_files():
    """Analyze files and categorize them"""
    files = []
    for f in Path(FOLDER_PATH).iterdir():
        if f.is_file() and f.suffix.lower() in EXTENSIONS:
            files.append(f)

    print(f"[STAT] Total files found: {len(files)}")
    print()

    # Categorize files
    standard_files = []      # Files with standard format
    non_standard_files = []  # Files to delete

    for f in files:
        if is_standard_filename(f.name):
            standard_files.append(f)
        else:
            non_standard_files.append(f)

    print(f"[ANALYSIS]")
    print(f"  Standard format (KEEP):    {len(standard_files)}")
    print(f"  Non-standard (DELETE):     {len(non_standard_files)}")
    print()

    total_size = sum(f.stat().st_size for f in non_standard_files)

    return {
        'total_files': len(files),
        'standard_files': standard_files,
        'non_standard_files': non_standard_files,
        'total_size_kb': total_size / 1024
    }

def preview(result):
    """Print detailed preview"""
    print("=" * 60)
    print("[FILES TO KEEP - Standard Format: 姓名_岗位.扩展名]")
    print("=" * 60)
    for f in sorted(result['standard_files'], key=lambda x: x.name):
        print(f"  [KEEP] {f.name} ({f.stat().st_size / 1024:.2f} KB)")

    print()
    print("=" * 60)
    print("[FILES TO DELETE - Non-Standard Format]")
    print("=" * 60)
    for f in sorted(result['non_standard_files'], key=lambda x: x.name):
        print(f"  [DELETE] {f.name} ({f.stat().st_size / 1024:.2f} KB)")

    print()
    print("=" * 60)
    print("[SUMMARY]")
    print("=" * 60)
    print(f"  Total files:      {result['total_files']}")
    print(f"  Keep (standard):  {len(result['standard_files'])}")
    print(f"  Delete:           {len(result['non_standard_files'])}")
    print(f"  Space saved:      {result['total_size_kb']:.2f} KB ({result['total_size_kb']/1024:.2f} MB)")
    print("=" * 60)
    print()
    print("[INFO] This is PREVIEW mode only.")
    print("       Run with --delete to actually delete files.")

def delete_files(result):
    """Delete non-standard files"""
    print("[CONFIRM] About to delete ALL non-standard files!")
    print(f"  Files to delete: {len(result['non_standard_files'])}")
    print(f"  Space to free:  {result['total_size_kb']:.2f} KB")
    print()

    confirm = input("Type 'YES' to confirm deletion: ")
    if confirm != 'YES':
        print("[CANCEL] Operation cancelled")
        return

    print()
    print("[EXECUTE] Deleting non-standard files...")

    deleted = 0
    errors = 0

    for f in result['non_standard_files']:
        try:
            f.unlink()
            print(f"  [DELETED] {f.name}")
            deleted += 1
        except Exception as e:
            print(f"  [ERROR] {f.name} - {e}")
            errors += 1

    print()
    print("=" * 60)
    print("[COMPLETE]")
    print(f"  Deleted:     {deleted}")
    if errors > 0:
        print(f"  Errors:      {errors}")
    print(f"  Space saved: {result['total_size_kb']:.2f} KB")
    print("=" * 60)

def main():
    result = analyze_files()

    if len(result['non_standard_files']) == 0:
        print("[DONE] All files are in standard format!")
        return

    if '--delete' in sys.argv:
        delete_files(result)
    else:
        preview(result)
        print()
        print("[USAGE]")
        print("  python deduplicate-resumes.py --preview  # Preview (default)")
        print("  python deduplicate-resumes.py --delete   # Delete files")

if __name__ == '__main__':
    main()
