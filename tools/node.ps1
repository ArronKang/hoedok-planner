# 이 PC에는 Node.js가 없어서, VS Code에 들어 있는 Electron을 Node처럼 실행한다.
#   powershell -File tools/node.ps1 tests/run-node.js
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NodeArgs)
$env:ELECTRON_RUN_AS_NODE = '1'
$code = Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\Code.exe'
if (-not (Test-Path $code)) { Write-Error "VS Code를 찾을 수 없어요: $code"; exit 2 }
$root = Split-Path -Parent $PSScriptRoot
$out = [System.IO.Path]::GetTempFileName()
$err = [System.IO.Path]::GetTempFileName()
$p = Start-Process -FilePath $code -ArgumentList $NodeArgs -Wait -PassThru -NoNewWindow -WorkingDirectory $root -RedirectStandardOutput $out -RedirectStandardError $err
Get-Content $out -Encoding UTF8
Get-Content $err -Encoding UTF8
Remove-Item $out, $err -ErrorAction SilentlyContinue
exit $p.ExitCode
