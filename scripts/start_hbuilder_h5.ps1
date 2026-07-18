param(
  [int]$Port = 8080,
  [string]$HostAddress = '127.0.0.1',
  [string]$HBuilderRoot = 'D:\HBuilderX'
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$uniCliRoot = Join-Path $HBuilderRoot 'plugins\uniapp-cli'
$node = Join-Path $HBuilderRoot 'plugins\node\node.exe'
$uniCli = Join-Path $uniCliRoot 'bin\uniapp-cli.js'
$outputDir = Join-Path $projectRoot 'unpackage\dist\dev\h5'

if (-not (Test-Path -LiteralPath $node)) {
  throw "HBuilderX Node.js not found: $node"
}

if (-not (Test-Path -LiteralPath $uniCli)) {
  throw "HBuilderX uni-app compiler not found: $uniCli"
}

$env:NODE_ENV = 'development'
$env:UNI_PLATFORM = 'h5'
$env:UNI_INPUT_DIR = $projectRoot
$env:UNI_OUTPUT_DIR = $outputDir
$env:VUE_CLI_CONTEXT = $uniCliRoot

Set-Location -LiteralPath $uniCliRoot
& $node $uniCli --auto-port $Port --auto-host $HostAddress
exit $LASTEXITCODE
