# Windows Compatibility Test for 'rapikan'
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Running Windows Compatibility Test for rapikan" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Check Bun installation
if (!(Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Bun runtime is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Bun first: https://bun.sh/" -ForegroundColor Yellow
    Exit 1
}

# 2. Setup temporary test directory
$TestDir = Join-Path (Get-Location) "test-data-temp"
if (Test-Path $TestDir) {
    Remove-Item -Recurse -Force $TestDir
}
New-Item -ItemType Directory -Path $TestDir | Out-Null

# 3. Create dummy files
$TestFile1 = Join-Path $TestDir "DJI_20260620120000_win_test.mp4"
$TestFile2 = Join-Path $TestDir "standard_file.txt"

New-Item -ItemType File -Path $TestFile1 -Value "dummy data" | Out-Null
New-Item -ItemType File -Path $TestFile2 -Value "dummy data" | Out-Null

Write-Host "`n[1/3] Temporary test files created in: $TestDir" -ForegroundColor Green

# 4. Execute rapikan tool
Write-Host "[2/3] Executing rapikan with -y (auto-confirm)..." -ForegroundColor Yellow
bun run index.ts $TestDir -y

# 5. Verify results
$ExpectedFolder1 = Join-Path $TestDir "2026-06-20"
$ExpectedFile1 = Join-Path $ExpectedFolder1 "DJI_20260620120000_win_test.mp4"

$Today = (Get-Date).ToString("yyyy-MM-dd")
$ExpectedFolder2 = Join-Path $TestDir $Today
$ExpectedFile2 = Join-Path $ExpectedFolder2 "standard_file.txt"

$Success = $true

if (Test-Path $ExpectedFile1) {
    Write-Host "[PASS] Date-from-filename file moved successfully to $ExpectedFolder1" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Date-from-filename file was not moved to $ExpectedFolder1" -ForegroundColor Red
    $Success = $false
}

if (Test-Path $ExpectedFile2) {
    Write-Host "[PASS] Metadata-date file moved successfully to $ExpectedFolder2" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Metadata-date file was not moved to $ExpectedFolder2" -ForegroundColor Red
    $Success = $false
}

# 6. Cleanup
Write-Host "`n[3/3] Cleaning up test-data-temp folder..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $TestDir

# 7. Print final result
Write-Host "=============================================" -ForegroundColor Cyan
if ($Success) {
    Write-Host " SUCCESS: Windows Compatibility Test Passed!" -ForegroundColor Green
} else {
    Write-Host " FAILED: Windows Compatibility Test Failed!" -ForegroundColor Red
    Exit 1
}
Write-Host "=============================================" -ForegroundColor Cyan
