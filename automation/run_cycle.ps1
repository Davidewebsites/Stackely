param(
    [switch]$Help
)

if ($Help) {
    Write-Host "Stackely Development Cycle Runner"
    Write-Host "Usage: .\automation\run_cycle.ps1"
    exit 0
}

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $projectRoot "app\frontend"
$automationDir = Join-Path $projectRoot "automation"

$buildOutputPath = Join-Path $automationDir "build_output.txt"
$lintOutputPath = Join-Path $automationDir "lint_output.txt"
$changedFilesPath = Join-Path $automationDir "changed_files.txt"
$diffPath = Join-Path $automationDir "last_diff.patch"

Write-Host "========================================================"
Write-Host "Stackely Development Cycle - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "========================================================"
Write-Host ""
Write-Host "[DIR] Working directory: $projectRoot"
Write-Host "[DIR] Frontend directory: $frontendDir"
Write-Host ""

Write-Host "------------------------------------------------------"
Write-Host "STEP 1: Git Status"
Write-Host "------------------------------------------------------"

try {
    $gitStatus = git status --porcelain 2>&1
    if ($gitStatus) {
        Write-Host "[*] Changed files:"
        $gitStatus | ForEach-Object { Write-Host "    $_" }
    } else {
        Write-Host "[OK] No uncommitted changes"
    }
}
catch {
    Write-Host "[WARN] Git not available or not initialized"
}

Write-Host ""
Write-Host "------------------------------------------------------"
Write-Host "STEP 2: Frontend Build (pnpm build)"
Write-Host "------------------------------------------------------"

$tempBuildOut = [System.IO.Path]::GetTempFileName()
$tempBuildErr = [System.IO.Path]::GetTempFileName()

$buildProcess = Start-Process -FilePath "pnpm.cmd" `
    -ArgumentList "build" `
    -WorkingDirectory $frontendDir `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $tempBuildOut `
    -RedirectStandardError $tempBuildErr

$buildOutput = @()
$buildOutput += Get-Content $tempBuildOut -ErrorAction SilentlyContinue
$buildOutput += Get-Content $tempBuildErr -ErrorAction SilentlyContinue
$buildOutput | Out-File -FilePath $buildOutputPath -Encoding UTF8 -Force

Remove-Item $tempBuildOut -ErrorAction SilentlyContinue
Remove-Item $tempBuildErr -ErrorAction SilentlyContinue

if ($buildProcess.ExitCode -eq 0) {
    Write-Host "[OK] Build successful"
    Write-Host "[OK] Build output saved to automation/build_output.txt"
} else {
    Write-Host "[ERROR] Build failed with exit code $($buildProcess.ExitCode)"
    Write-Host "[ERROR] Build output saved to automation/build_output.txt"
    exit 1
}

Write-Host ""
Write-Host "------------------------------------------------------"
Write-Host "STEP 3: Frontend Lint (pnpm lint)"
Write-Host "------------------------------------------------------"

$tempLintOut = [System.IO.Path]::GetTempFileName()
$tempLintErr = [System.IO.Path]::GetTempFileName()

$lintProcess = Start-Process -FilePath "pnpm.cmd" `
    -ArgumentList "lint" `
    -WorkingDirectory $frontendDir `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $tempLintOut `
    -RedirectStandardError $tempLintErr

$lintOutput = @()
$lintOutput += Get-Content $tempLintOut -ErrorAction SilentlyContinue
$lintOutput += Get-Content $tempLintErr -ErrorAction SilentlyContinue
$lintOutput | Out-File -FilePath $lintOutputPath -Encoding UTF8 -Force

Remove-Item $tempLintOut -ErrorAction SilentlyContinue
Remove-Item $tempLintErr -ErrorAction SilentlyContinue

if ($lintProcess.ExitCode -eq 0) {
    Write-Host "[OK] Lint passed"
    Write-Host "[OK] Lint output saved to automation/lint_output.txt"
} else {
    Write-Host "[ERROR] Lint failed with exit code $($lintProcess.ExitCode)"
    Write-Host "[ERROR] Lint output saved to automation/lint_output.txt"
    exit 1
}

Write-Host ""
Write-Host "------------------------------------------------------"
Write-Host "STEP 4: Track Changed Files"
Write-Host "------------------------------------------------------"

try {
    git diff --name-only | Out-File -FilePath $changedFilesPath -Encoding UTF8 -Force
    Write-Host "[OK] Saved to: automation/changed_files.txt"
}
catch {
    Write-Host "[WARN] Could not save changed files"
}

Write-Host ""
Write-Host "------------------------------------------------------"
Write-Host "STEP 5: Generate Diff Patch"
Write-Host "------------------------------------------------------"

$diffPath = Join-Path $automationDir "last_diff.patch"

$tempDiffOut = [System.IO.Path]::GetTempFileName()
$tempDiffErr = [System.IO.Path]::GetTempFileName()

$diffProcess = Start-Process -FilePath "git" `
    -ArgumentList "diff" `
    -WorkingDirectory $projectRoot `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $tempDiffOut `
    -RedirectStandardError $tempDiffErr

$diffStdOut = Get-Content $tempDiffOut -ErrorAction SilentlyContinue
$diffStdErr = Get-Content $tempDiffErr -ErrorAction SilentlyContinue

Remove-Item $tempDiffOut -ErrorAction SilentlyContinue
Remove-Item $tempDiffErr -ErrorAction SilentlyContinue

if ($diffProcess.ExitCode -eq 0) {
    $diffStdOut | Out-File -FilePath $diffPath -Encoding UTF8 -Force
    Write-Host "[OK] Saved to: automation/last_diff.patch"

    $tempStatOut = [System.IO.Path]::GetTempFileName()
    $tempStatErr = [System.IO.Path]::GetTempFileName()

    $statProcess = Start-Process -FilePath "git" `
        -ArgumentList "diff", "--stat" `
        -WorkingDirectory $projectRoot `
        -NoNewWindow `
        -Wait `
        -PassThru `
        -RedirectStandardOutput $tempStatOut `
        -RedirectStandardError $tempStatErr

    $statStdOut = Get-Content $tempStatOut -ErrorAction SilentlyContinue
    $statStdErr = Get-Content $tempStatErr -ErrorAction SilentlyContinue

    Remove-Item $tempStatOut -ErrorAction SilentlyContinue
    Remove-Item $tempStatErr -ErrorAction SilentlyContinue

    if ($statStdOut) {
        Write-Host "[STAT] Diff stats:"
        $statStdOut | ForEach-Object { Write-Host "    $_" }
    } else {
        Write-Host "[INFO] No diff stats available"
    }

    if ($statStdErr) {
        Write-Host "[INFO] Git warnings detected during diff stat output"
    }
} else {
    Write-Host "[WARN] Could not generate patch"
    if ($diffStdErr) {
        $diffStdErr | ForEach-Object { Write-Host "    $_" }
    }
}