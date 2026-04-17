# Resume Deduplication Script
param(
    [string]$FolderPath = "d:\小孙文件\demo_vscode\LStwinHR-dev_v0.0.3\uploads\resumes",
    [switch]$PreviewOnly,
    [switch]$DeleteDuplicates
)

Write-Host "========================================"
Write-Host "       Resume Deduplication Tool v1.0"
Write-Host "========================================"
Write-Host ""

if (-not (Test-Path $FolderPath)) {
    Write-Host "[ERROR] Directory not found: $FolderPath" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Scanning: $FolderPath"
Write-Host ""

$allFiles = Get-ChildItem -Path $FolderPath -File | Where-Object { $_.Extension -in @('.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png') }

Write-Host "[STAT] Total files found: $($allFiles.Count)"
Write-Host ""

function Get-BaseFileName {
    param([string]$FileName)
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
    $baseName = $baseName -replace '_\d{13}_\d{6}(_\d{13}_\d{6})*$', ''
    $baseName = $baseName -replace '(_未测MBTI)+$', ''
    return $baseName
}

$fileGroups = @{}
foreach ($file in $allFiles) {
    $baseName = Get-BaseFileName $file.Name
    if (-not $fileGroups.ContainsKey($baseName)) {
        $fileGroups[$baseName] = @()
    }
    $fileGroups[$baseName] += $file
}

Write-Host "[ANALYSIS] Unique candidates: $($fileGroups.Count)"
Write-Host ""

$duplicateInfo = @()
$totalDuplicates = 0
$totalSizeSaved = 0

foreach ($baseName in $fileGroups.Keys | Sort-Object) {
    $files = $fileGroups[$baseName]

    if ($files.Count -eq 1) {
        Write-Host "[KEEP]  $($files[0].Name)" -ForegroundColor Gray
        continue
    }

    Write-Host ""
    Write-Host "[CANDIDATE] $baseName" -ForegroundColor Magenta
    Write-Host "            File count: $($files.Count)"

    $fileHashes = @{}
    foreach ($file in $files) {
        try {
            $hash = (Get-FileHash -Path $file.FullName -Algorithm MD5 -ErrorAction Stop).Hash
            if (-not $fileHashes.ContainsKey($hash)) {
                $fileHashes[$hash] = @()
            }
            $fileHashes[$hash] += $file
        } catch {
            Write-Host "  [WARN] Cannot hash: $($file.Name)" -ForegroundColor Yellow
        }
    }

    $originalFile = $null
    $duplicateFiles = @()

    foreach ($hash in $fileHashes.Keys) {
        $filesWithHash = $fileHashes[$hash] | Sort-Object { $_.Name.Length }
        $keptFile = $filesWithHash[0]
        $duplicatesForHash = $filesWithHash[1..($filesWithHash.Length-1)]

        if ($originalFile -eq $null) {
            $originalFile = $keptFile
            Write-Host "  [KEPT] $($keptFile.Name)"
            Write-Host "         Size: $([math]::Round($keptFile.Length / 1KB, 2)) KB"
        }

        foreach ($dup in $duplicatesForHash) {
            $duplicateFiles += $dup
            $totalDuplicates++
            $totalSizeSaved += $dup.Length
        }
    }

    if ($duplicateFiles.Count -gt 0) {
        Write-Host "  [TO DELETE] ($($duplicateFiles.Count) files):"
        foreach ($dup in $duplicateFiles) {
            Write-Host "    - $($dup.Name)" -ForegroundColor DarkYellow
            Write-Host "      Size: $([math]::Round($dup.Length / 1KB, 2)) KB"
        }
        $duplicateInfo += @{ BaseName = $baseName; Original = $originalFile; Duplicates = $duplicateFiles }
    }
    Write-Host ""
}

Write-Host "========================================"
Write-Host "[SUMMARY]"
Write-Host "  Unique candidates: $($fileGroups.Count)"
Write-Host "  Duplicate files:   $totalDuplicates"
Write-Host "  Space to save:    $([math]::Round($totalSizeSaved / 1MB, 2)) MB"
Write-Host "========================================"
Write-Host ""

if ($duplicateInfo.Count -eq 0) {
    Write-Host "[DONE] No duplicate files found" -ForegroundColor Green
    exit 0
}

if ($PreviewOnly) {
    Write-Host "[PREVIEW] Use -DeleteDuplicates to actually delete" -ForegroundColor Yellow
    exit 0
}

if (-not $DeleteDuplicates) {
    Write-Host "[INFO] This is PREVIEW mode only"
    Write-Host "       Add -DeleteDuplicates to delete" -ForegroundColor Yellow
    exit 0
}

Write-Host "[CONFIRM] About to delete $totalDuplicates files, free $([math]::Round($totalSizeSaved / 1MB, 2)) MB" -ForegroundColor Red
$confirmation = Read-Host "Type 'YES' to confirm deletion"

if ($confirmation -ne 'YES') {
    Write-Host "[CANCEL] Operation cancelled"
    exit 0
}

Write-Host ""
Write-Host "[EXECUTE] Deleting duplicates..."

$deletedCount = 0
$errorCount = 0

foreach ($group in $duplicateInfo) {
    Write-Host ""
    Write-Host "[PROCESSING] $($group.BaseName)" -ForegroundColor Magenta
    foreach ($dup in $group.Duplicates) {
        try {
            Remove-Item -Path $dup.FullName -Force
            Write-Host "  [DELETED] $($dup.Name)" -ForegroundColor Red
            $deletedCount++
        } catch {
            Write-Host "  [ERROR] $($dup.Name)" -ForegroundColor Red
            $errorCount++
        }
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "[COMPLETE]"
Write-Host "  Deleted:    $deletedCount"
if ($errorCount -gt 0) { Write-Host "  Errors:     $errorCount" -ForegroundColor Red }
Write-Host "  Space saved: $([math]::Round($totalSizeSaved / 1MB, 2)) MB"
Write-Host "========================================"
