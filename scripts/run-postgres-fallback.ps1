# File note: dedicated helper that keeps PostgreSQL running in a separate PowerShell window.
# Purpose: run postgres.exe in the foreground so the local fallback can stay attached to a console.

param(
  [Parameter(Mandatory = $true)]
  [string]$DataDir,

  [Parameter(Mandatory = $true)]
  [int]$Port,

  [Parameter(Mandatory = $true)]
  [string]$PostgresExe
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

& $PostgresExe -D $DataDir -p $Port
