param(
    [string]$Repository,

    [string]$RemoteName = 'origin',

    [ValidateSet('ssh', 'https')]
    [string]$Protocol = 'ssh',

    [string]$SshHost = 'github.com'
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

if (-not $Repository) {
    $Repository = Read-Host "Repository (owner/repo)"
}

if (-not $Repository) {
    throw "Repository 不能为空。"
}

if ($Protocol -eq 'ssh' -and -not $PSBoundParameters.ContainsKey('SshHost')) {
    $useAlias = Read-Host "是否使用 SSH Host 别名？(y/N)"
    if ($useAlias -match '^(y|yes)$') {
        $aliasInput = Read-Host "请输入 SSH Host 别名（直接回车默认 github-sunner）"
        if (-not [string]::IsNullOrWhiteSpace($aliasInput)) {
            $SshHost = $aliasInput.Trim()
        } else {
            $SshHost = 'github-sunner'
        }
    }
}

if ($Repository -notmatch '^[^/]+/[^/]+$') {
    throw "Repository 格式必须是 owner/repo，例如 TheRealPiper/LStwinHR"
}

$remoteUrl = if ($Protocol -eq 'ssh') {
    "git@${SshHost}:$Repository.git"
} else {
    "https://github.com/$Repository.git"
}

$existingRemote = & git remote
$hasRemote = $existingRemote -contains $RemoteName

if ($hasRemote) {
    Write-Host "[set-git-remote] 更新远程 $RemoteName -> $remoteUrl" -ForegroundColor Cyan
    & git remote set-url $RemoteName $remoteUrl
    if ($LASTEXITCODE -ne 0) {
        throw "git remote set-url 失败"
    }
} else {
    Write-Host "[set-git-remote] 新增远程 $RemoteName -> $remoteUrl" -ForegroundColor Cyan
    & git remote add $RemoteName $remoteUrl
    if ($LASTEXITCODE -ne 0) {
        throw "git remote add 失败"
    }
}

Write-Host "[set-git-remote] 当前远程配置：" -ForegroundColor Green
& git remote -v
