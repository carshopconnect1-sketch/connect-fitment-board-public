$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$previewRoot = Join-Path $projectRoot '.preview'
$previewPort = 4185
$previewUrl = "http://127.0.0.1:$previewPort/"
$vitePath = Join-Path $projectRoot 'node_modules/vite/bin/vite.js'
$bundledNode = 'C:/Users/CONNECT_creator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$nodePath = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { (Get-Command node -ErrorAction Stop).Source }
if (!(Test-Path -LiteralPath $vitePath)) { throw 'Viteがありません。先にprototype内でnpm installを実行してください。' }
$listenerErrors = @()
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort $previewPort -ErrorAction SilentlyContinue -ErrorVariable listenerErrors)
$inspectionFailures = @($listenerErrors | Where-Object { $_.FullyQualifiedErrorId -notlike 'CmdletizationQuery_NotFound*' })
if ($inspectionFailures.Count -gt 0) { throw "ポート所有者を検査できません。起動していません。$($inspectionFailures[0].Exception.Message)" }
if ($listeners.Count -gt 0) {
  foreach ($listener in $listeners) {
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    if (!$owner.CommandLine -or !$owner.CommandLine.Contains($projectRoot) -or !$owner.CommandLine.Contains('vite')) {
      throw "ポート$previewPortは別のプロセス（PID $($listener.OwningProcess)）が使用中です。停止・ポート変更はしていません。"
    }
  }
  $response = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 5
  if ($response.StatusCode -ne 200 -or !$response.Content.Contains('適合・開発管理')) { throw '同じプロジェクトの既存サーバーに正常な応答がありません。ログを確認してください。' }
  Write-Output "既存サーバーを再利用: $previewUrl PID $($listeners[0].OwningProcess)"
  exit 0
}
New-Item -ItemType Directory -Path $previewRoot -Force | Out-Null
$stdout = Join-Path $previewRoot 'server.stdout.log'
$stderr = Join-Path $previewRoot 'server.stderr.log'
$arguments = @(('"' + $vitePath + '"'), '--host', '127.0.0.1', '--port', "$previewPort", '--strictPort')
$process = Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
[ordered]@{ startedAt = (Get-Date).ToString('o'); projectRoot = $projectRoot; pid = $process.Id; executable = $nodePath; arguments = $arguments; url = $previewUrl; stdout = $stdout; stderr = $stderr; scope = 'loopback'; actualBrowserVerified = $false } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $previewRoot 'server.json') -Encoding UTF8
$healthy = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try { $response = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200 -and $response.Content.Contains('適合・開発管理')) { $healthy = $true; break } } catch { }
  if (!(Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 250
}
if (!$healthy) { if (Test-Path -LiteralPath $stderr) { Get-Content -LiteralPath $stderr -Tail 20 }; throw "HTTP応答未確認: $previewUrl。ログ: $previewRoot" }
Write-Output "プレビューを起動: $previewUrl PID $($process.Id)。ブラウザー表示を別途確認してください。"
