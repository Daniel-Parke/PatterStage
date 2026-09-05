# ===============================================================
# PatterStage targets Linux. On Windows, run it under WSL2 (Ubuntu) — the same
# environment as production and as PatterOS. There is no native-Windows install
# path; this stub only points the way. See docs/CROSS_PLATFORM.md.
# ===============================================================
Write-Host ''
Write-Host 'PatterStage targets Linux. On Windows, use WSL2 (Ubuntu):'
Write-Host ''
Write-Host '  1) Install WSL2 (one-time, from an elevated PowerShell):'
Write-Host '       wsl --install -d Ubuntu'
Write-Host '     Reboot if prompted, then open the "Ubuntu" app.'
Write-Host ''
Write-Host '  2) Inside Ubuntu, install PatterStage:'
Write-Host '       git clone https://github.com/Daniel-Parke/PatterStage.git'
Write-Host '       cd PatterStage'
Write-Host '       bash scripts/bootstrap/install.sh --in-repo'
Write-Host '       npm run start:network'
Write-Host ''
Write-Host '  WSL2 forwards localhost, so open the dashboard from Windows at the'
Write-Host '  URL setup prints (e.g. http://127.0.0.1:42069/).'
Write-Host ''
Write-Host 'Details: docs/CROSS_PLATFORM.md'
