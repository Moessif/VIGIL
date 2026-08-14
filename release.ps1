# ============================================================
#  Release script: semver bump + zip backup + changelog + git tag
#  Usage:
#    powershell -ExecutionPolicy Bypass -File release.ps1 -Bump patch -Message "fixed x"
#    powershell -ExecutionPolicy Bypass -File release.ps1 -Bump minor -Message "new feature"
#    powershell -ExecutionPolicy Bypass -File release.ps1 -Bump major -Message "breaking change"
# ============================================================
param(
  [ValidateSet('patch', 'minor', 'major')] [string]$Bump = 'patch',
  [string]$Message = ''
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

# ---- load config ----
$cfg = Get-Content (Join-Path $root 'release.config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$changelogFile = Join-Path $cfg.changelogDir $cfg.changelogFileName
$changelogTitle = $cfg.changelogTitle
$backupDir = Join-Path $root $cfg.backupDir
$utf8 = New-Object System.Text.UTF8Encoding $false

# ---- current version ----
$pkgPath = Join-Path $root 'package.json'
$pkgRaw = [System.IO.File]::ReadAllText($pkgPath, [System.Text.Encoding]::UTF8)
$m = [regex]::Match($pkgRaw, '"version"\s*:\s*"([^"]+)"')
if (-not $m.Success) { throw 'version not found in package.json' }
$cur = [version]$m.Groups[1].Value

# ---- new version ----
switch ($Bump) {
  'patch' { $new = [version]::new($cur.Major, $cur.Minor, $cur.Build + 1) }
  'minor' { $new = [version]::new($cur.Major, $cur.Minor + 1, 0) }
  'major' { $new = [version]::new($cur.Major + 1, 0, 0) }
}
$newStr = "$($new.Major).$($new.Minor).$($new.Build)"
$newTag = "v$newStr"
$date = Get-Date -Format 'yyyy-MM-dd'

Write-Host "Releasing $newTag (from $($cur.Major).$($cur.Minor).$($cur.Build)) ..."

# ---- bump version in all package.json ----
$pkgFiles = @('package.json', 'apps/server/package.json', 'apps/web/package.json', 'packages/shared/package.json')
foreach ($f in $pkgFiles) {
  $full = Join-Path $root $f
  if (Test-Path $full) {
    $txt = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
    $txt = [regex]::Replace($txt, '"version"\s*:\s*"[^"]+"', ('"version": "' + $newStr + '"'), 1)
    [System.IO.File]::WriteAllText($full, $txt, $utf8)
  }
}

# ---- zip backup (exclude node_modules/dist/.env/data/backups/.git) ----
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$stage = Join-Path $env:TEMP ('jxh-release-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
robocopy $root $stage /E /XD node_modules dist data backups .git /XF .env .env.local *.log | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }
$zipPath = Join-Path $backupDir "$newTag.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath -Force
Remove-Item $stage -Recurse -Force

# ---- changelog (newest first) ----
$summary = if ($Message) { $Message } else { "release ($Bump)" }
$entry = "## $newTag ($date)`n$summary`n`n"
if (Test-Path $changelogFile) {
  $existing = [System.IO.File]::ReadAllText($changelogFile, $utf8)
  $existing = [regex]::Replace($existing, '^' + [regex]::Escape($changelogTitle) + '\s*', '', 'Singleline')
  $newContent = $changelogTitle + "`n`n" + $entry + $existing
} else {
  New-Item -ItemType Directory -Path (Split-Path $changelogFile) -Force | Out-Null
  $newContent = $changelogTitle + "`n`n" + $entry
}
[System.IO.File]::WriteAllText($changelogFile, $newContent, $utf8)

# ---- git commit + tag + push ----
git add -A
git commit -m "release: $newTag" --allow-empty | Out-Null
git tag $newTag 2>$null

$remote = git remote get-url origin 2>$null
if ($remote) {
  git push origin HEAD --tags 2>&1 | Out-Null
  $pushed = $true
} else {
  $pushed = $false
}

Write-Host ''
Write-Host "=== Released $newTag ===" -ForegroundColor Green
Write-Host "Backup:   $zipPath"
Write-Host "Changelog:$changelogFile"
if ($pushed) {
  Write-Host 'GitHub:   pushed to origin'
} else {
  Write-Host 'GitHub:   no remote origin, skipped push (run: git remote add origin <url>)'
}
