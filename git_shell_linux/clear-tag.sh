#!/bin/bash

# 删除远程标签

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORIGINAL_DIR="$(pwd)"

TAG_NAME=""
KEEP_LOCAL_TAG=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --tag-name|-t)
            TAG_NAME="$2"
            shift 2
            ;;
        --keep-local-tag)
            KEEP_LOCAL_TAG=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

cd "$SCRIPT_DIR"

find_git_repo_root() {
    local current="$1"
    while [ -n "$current" ]; do
        if [ -d "$current/.git" ]; then
            echo "$current"
            return 0
        fi
        parent="$(dirname "$current")"
        if [ "$parent" = "$current" ]; then
            break
        fi
        current="$parent"
    done
    echo ""
}

normalize_tag_name() {
    local input_tag="$1"
    if [ -z "$input_tag" ]; then
        echo ""
        return
    fi
    
    normalized=$(echo "$input_tag" | tr -d '[:space:]')
    if [ -z "$normalized" ]; then
        echo ""
        return
    fi
    
    if ! echo "$normalized" | grep -q '^v'; then
        normalized="v$normalized"
    fi
    
    echo "$normalized"
}

resolve_tag_name() {
    TAG_RESULT=""
    TAG_REMOTE_EXISTS="false"
    
    if [ -n "$TAG_NAME" ]; then
        normalized=$(normalize_tag_name "$TAG_NAME")
        TAG_RESULT="$normalized|false"
        return
    fi
    
    mapfile -t remote_tags < <(git ls-remote --tags origin 2>/dev/null | while read line; do
        if [ -z "$line" ]; then continue; fi
        ref=$(echo "$line" | awk '{print $2}')
        if [ -z "$ref" ]; then continue; fi
        if echo "$ref" | grep -qE '^refs/tags/.+'; then
            echo "$ref" | sed "s|^refs/tags/||; s|\^{}||"
        fi
    done | sort -u)
    
    local_tags=$(git tag --list 'v*' 2>/dev/null || true)
    
    if [ ${#remote_tags[@]} -eq 0 ]; then
        if [ -n "$local_tags" ]; then
            echo -e "\033[33m[delete-remote-tag] 当前未检测到远端版本标签。\033[0m"
            echo -e "\033[36m[delete-remote-tag] 当前本地标签：\033[0m"
            echo -e "  \033[37m$local_tags\033[0m"
            
            while true; do
                read -p "请输入要删除的本地版本标签（例如 v0.0.1）: " input_tag
                resolved_tag=$(normalize_tag_name "$input_tag")
                if [ -z "$resolved_tag" ]; then
                    echo -e "\033[33m[delete-remote-tag] 标签名不能为空，请重新输入。\033[0m"
                    continue
                fi
                
                if echo "$local_tags" | grep -q "^${resolved_tag}$"; then
                    TAG_RESULT="$resolved_tag|false"
                    return
                fi
                
                echo -e "\033[33m[delete-remote-tag] 本地不存在标签 $resolved_tag，请重新输入。\033[0m"
            done
        fi
        
        echo "未检测到远端版本标签。" >&2
        exit 1
    fi
    
    echo -e "\033[36m[delete-remote-tag] 当前远端标签：\033[0m"
    echo -e "  \033[37m$(IFS=', '; echo "${remote_tags[*]}")\033[0m"
    
    while true; do
        read -p "请输入要删除的版本标签（例如 v0.0.1）: " input_tag
        resolved_tag=$(normalize_tag_name "$input_tag")
        if [ -z "$resolved_tag" ]; then
            echo -e "\033[33m[delete-remote-tag] 标签名不能为空，请重新输入。\033[0m"
            continue
        fi
        
        for t in "${remote_tags[@]}"; do
            if [ "$t" = "$resolved_tag" ]; then
                TAG_RESULT="$resolved_tag|true"
                return
            fi
        done
        
        echo -e "\033[33m[delete-remote-tag] 远端不存在标签 $resolved_tag，请重新输入。\033[0m"
    done
}

PROJECT_ROOT=$(find_git_repo_root "$SCRIPT_DIR")
if [ -z "$PROJECT_ROOT" ]; then
    echo "未能定位 Git 仓库根目录。请在仓库内运行该脚本。" >&2
    exit 1
fi

cd "$PROJECT_ROOT"

remote_url=$(git remote get-url origin 2>/dev/null || true)
if [ -z "$remote_url" ]; then
    echo "未检测到 origin 远程。" >&2
    exit 1
fi

git fetch --tags origin
if [ $? -ne 0 ]; then
    echo "git fetch --tags 失败。" >&2
    exit 1
fi

resolve_tag_name
tag_result="$TAG_RESULT"
resolved_tag_name=$(echo "$tag_result" | cut -d'|' -f1)
remote_exists_str=$(echo "$tag_result" | cut -d'|' -f2)
if [ "$remote_exists_str" = "true" ]; then
    remote_exists=true
else
    remote_exists=false
fi

echo -e "\033[33m[delete-remote-tag] 远端: $remote_url\033[0m"
if [ "$remote_exists" = true ]; then
    echo -e "\033[33m[delete-remote-tag] 即将删除远端标签: $resolved_tag_name\033[0m"
else
    echo -e "\033[33m[delete-remote-tag] 即将删除本地标签: $resolved_tag_name\033[0m"
fi
read -p "确认删除该远端标签吗？(y/N): " confirm
if ! [[ "$confirm" =~ ^(y|yes)$ ]]; then
    echo -e "\033[33m[delete-remote-tag] 已取消操作。\033[0m"
    exit 0
fi

if [ "$remote_exists" = true ]; then
    echo -e "\033[36m[delete-remote-tag] 删除远端标签...\033[0m"
    git push origin ":refs/tags/$resolved_tag_name"
    if [ $? -ne 0 ]; then
        echo "删除远端标签失败。" >&2
        exit 1
    fi
fi

if [ "$KEEP_LOCAL_TAG" != true ]; then
    git rev-parse "refs/tags/$resolved_tag_name" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "\033[36m[delete-remote-tag] 删除本地标签...\033[0m"
        git tag -d "$resolved_tag_name"
        if [ $? -ne 0 ]; then
            echo "删除本地标签失败。" >&2
            exit 1
        fi
    fi
fi

echo -e "\033[32m[delete-remote-tag] 标签删除完成：$resolved_tag_name\033[0m"

cd "$ORIGINAL_DIR"
