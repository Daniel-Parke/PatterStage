# ===============================================================
# PatterStage - Windows installer (PowerShell). The native-Windows
# counterpart to scripts/bootstrap/install.sh. Bootstraps only: verifies
# Node + Git, clones (or updates), then hands off to the cross-platform
# scripts/bootstrap/setup.mjs which does all the real work.
#
#   iex (irm https://raw.githubusercontent.com/Daniel-Parke/PatterStage/dev/install.ps1)
#   # or, from an existing clone:
#   powershell -ExecutionPolicy Bypass -File install.ps1 -InRepo
# ===============================================================
[CmdletBinding()]
param(
  [string]$InstallDir = (Join-Path $HOME 'patterstage'),
  [string]$Repo = 'https://github.com/Daniel-Parke/PatterStage.git',
  [string]$Branch = 'dev',
  [switch]$InRepo
)
$ErrorActionPreference = 'Stop'

function Require-Command($name, $hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Error "$name not found. $hint"
    exit 1
  }
}

Write-Host '=== PatterStage - Windows Installer ==='

Require-Command node 'Install Node.js 20+ from https://nodejs.org'
Require-Command git  'Install Git from https://git-scm.com'

$nodeMajor = [int]((node -v).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) { Write-Error "Node.js 20+ required (found $(node -v))"; exit 1 }
Write-Host "OK  Node.js $(node -v)"

if ($InRepo) {
  $repoRoot = (Get-Location).Path
} elseif (Test-Path $InstallDir) {
  Write-Host "Updating existing clone at $InstallDir"
  Set-Location $InstallDir
  git fetch origin $Branch --quiet
  git checkout $Branch --quiet
  git reset --hard "origin/$Branch" --quiet
  $repoRoot = $InstallDir
} else {
  Write-Host "Cloning PatterStage -> $InstallDir"
  git clone --branch $Branch $Repo $InstallDir
  Set-Location $InstallDir
  $repoRoot = $InstallDir
}

Write-Host 'Running setup...'
node (Join-Path $repoRoot 'scripts\bootstrap\setup.mjs')

Write-Host ''
Write-Host 'Done. Start PatterStage:'
Write-Host "  cd $repoRoot"
Write-Host '  npm run start:network'
