$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$sqlFiles = @(
  (Join-Path $PSScriptRoot "patch-save-company-members-rpc.sql"),
  (Join-Path $PSScriptRoot "patch-list-company-members-with-invites-rpc.sql")
)

$psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlCommand) {
  Write-Host "psql이 설치되어 있지 않습니다."
  Write-Host "PostgreSQL 클라이언트를 설치한 뒤 다시 실행하세요."
  Write-Host "예시:"
  Write-Host '  winget install PostgreSQL.PostgreSQL'
  exit 1
}

$dbUrl = $env:SUPABASE_DB_URL
if ([string]::IsNullOrWhiteSpace($dbUrl)) {
  Write-Host "환경변수 SUPABASE_DB_URL이 설정되어 있지 않습니다."
  Write-Host "현재 PowerShell 세션 예시:"
  Write-Host '  $env:SUPABASE_DB_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"'
  exit 1
}

foreach ($sqlFile in $sqlFiles) {
  if (-not (Test-Path -LiteralPath $sqlFile)) {
    Write-Host "SQL 파일을 찾을 수 없습니다: $sqlFile"
    exit 1
  }
}

Push-Location $repoRoot
try {
  foreach ($sqlFile in $sqlFiles) {
    Write-Host "적용 중: $sqlFile"
    & $psqlCommand.Source $dbUrl -v ON_ERROR_STOP=1 -f $sqlFile
    if ($LASTEXITCODE -ne 0) {
      throw "psql 실행 실패: $sqlFile"
    }
  }

  Write-Host "Supabase SQL 패치 적용 완료"
} finally {
  Pop-Location
}
