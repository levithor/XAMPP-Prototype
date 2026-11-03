$ErrorActionPreference = 'Continue'
$repoRoot = $PSScriptRoot
$originalLocation = Get-Location
$results = @()

function Invoke-NpmTestSuite {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$RelativeDirectory,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$RequiredDependencyPath
    )

    Write-Host "`n========== $Name =========="
    $directory = Join-Path $repoRoot $RelativeDirectory
    $packagePath = Join-Path $directory 'package.json'
    $dependencyPath = Join-Path $directory $RequiredDependencyPath

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host 'FAIL: npm was not found. Install Node.js/npm and make sure npm is on PATH.'
        return 1
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host 'FAIL: node was not found. Install Node.js and make sure node is on PATH.'
        return 1
    }
    if (-not (Test-Path $packagePath)) {
        Write-Host "FAIL: package.json was not found at $packagePath."
        return 1
    }
    if (-not (Test-Path $dependencyPath)) {
        Write-Host "FAIL: required installed dependencies are missing at $dependencyPath. Install this suite's dependencies as described in TESTING.md."
        return 1
    }

    Push-Location $directory
    try {
        & npm @Arguments | Out-Host
        $suiteExitCode = $LASTEXITCODE
        if ($null -eq $suiteExitCode) {
            $suiteExitCode = 1
        }
        return [int]$suiteExitCode
    }
    catch {
        Write-Host "FAIL: could not start npm test command: $($_.Exception.Message)"
        return 1
    }
    finally {
        Pop-Location
    }
}

function Invoke-PythonTestSuite {
    Write-Host "`n========== Python / YOLO =========="
    $yoloDirectory = Join-Path $repoRoot 'YOLO'
    $pythonPath = Join-Path $yoloDirectory 'venv\Scripts\python.exe'

    if (-not (Test-Path $pythonPath)) {
        Write-Host "FAIL: Python virtual environment was not found at $pythonPath. Create it and install YOLO\requirements.txt and YOLO\requirements-test.txt as described in TESTING.md."
        return 1
    }

    Push-Location $yoloDirectory
    try {
        & $pythonPath -m pytest -q -p no:cacheprovider | Out-Host
        $suiteExitCode = $LASTEXITCODE
        if ($null -eq $suiteExitCode) {
            $suiteExitCode = 1
        }
        return [int]$suiteExitCode
    }
    catch {
        Write-Host "FAIL: could not start the Python test command: $($_.Exception.Message)"
        return 1
    }
    finally {
        Pop-Location
    }
}

try {
    Push-Location $repoRoot

    $results += [PSCustomObject]@{
        Name = 'Frontend / Vitest'
        ExitCode = Invoke-NpmTestSuite -Name 'Frontend / Vitest' -RelativeDirectory 'frontend' -Arguments @('test', '--', '--reporter=dot') -RequiredDependencyPath 'node_modules\.bin\vitest.cmd'
    }
    $results += [PSCustomObject]@{
        Name = 'Backend / Node.js'
        ExitCode = Invoke-NpmTestSuite -Name 'Backend / Node.js' -RelativeDirectory 'backend' -Arguments @('test') -RequiredDependencyPath 'node_modules'
    }
    $results += [PSCustomObject]@{
        Name = 'Python / YOLO'
        ExitCode = Invoke-PythonTestSuite
    }
}
finally {
    Pop-Location
    Set-Location $originalLocation
}

Write-Host "`n========== Test Summary =========="
$allPassed = $true
foreach ($result in $results) {
    if ($result.ExitCode -eq 0) {
        Write-Host ("PASS  {0}" -f $result.Name)
    }
    else {
        Write-Host ("FAIL  {0} (exit code {1})" -f $result.Name, $result.ExitCode)
        $allPassed = $false
    }
}

if ($allPassed) {
    exit 0
}

exit 1
