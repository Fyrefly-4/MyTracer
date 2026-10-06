param([Parameter(Mandatory)][string]$Archive, [Parameter(Mandatory)][string]$Destination, [Parameter(Mandatory)][string]$Version)
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') { throw 'Invalid version' }
$taskWorkspace = [System.IO.Path]::GetFullPath((Get-Location).Path)
$taskDestination = [System.IO.Path]::GetFullPath($Destination)
$taskAllowedRoot = [System.IO.Path]::GetFullPath((Join-Path $taskWorkspace '.tmp')) + [System.IO.Path]::DirectorySeparatorChar
if (-not $taskDestination.StartsWith($taskAllowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid extraction root' }
if (Test-Path -LiteralPath $taskDestination) { throw 'Extraction root must be new' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$taskZip = [System.IO.Compression.ZipFile]::OpenRead([System.IO.Path]::GetFullPath($Archive))
try {
  $taskSetup = "MyTracer-$Version-x64-setup.exe"
  $taskAllowed = @($taskSetup, "$taskSetup.blockmap", 'latest.yml', 'SHA256SUMS.txt', 'candidate-manifest.json')
  if ($taskZip.Entries.Count -ne 5) { throw 'Invalid archive file count' }
  $taskSeen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
  foreach ($taskEntry in $taskZip.Entries) {
    if ($taskEntry.FullName -cnotin $taskAllowed -or -not $taskSeen.Add($taskEntry.FullName)) { throw 'Invalid archive path' }
    if ($taskEntry.Length -le 0 -or $taskEntry.Length -gt 536870912) { throw 'Invalid archive file size' }
  }
  New-Item -ItemType Directory -Path $taskDestination | Out-Null
  foreach ($taskEntry in $taskZip.Entries) {
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($taskEntry, (Join-Path $taskDestination $taskEntry.FullName), $false)
  }
} finally { $taskZip.Dispose() }
