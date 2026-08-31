param (
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Version
)

bun run "$PSScriptRoot/scripts/set-version.ts" $Version
