param(
  [string]$InputPath = "docs/demo-narration.md",
  [string]$OutputPath = "artifacts/demo-narration.wav"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

$source = Get-Content -LiteralPath $InputPath
$paragraphs = $source |
  Where-Object { $_ -and -not $_.StartsWith("#") -and -not $_.StartsWith("Target length:") } |
  ForEach-Object { $_.Trim() }
$text = $paragraphs -join " "

$output = [System.IO.Path]::GetFullPath($OutputPath)
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($output)) | Out-Null

$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voice.SelectVoice("Microsoft Zira Desktop")
  $voice.Rate = -1
  $voice.Volume = 100
  $voice.SetOutputToWaveFile($output)
  $voice.Speak($text)
} finally {
  $voice.Dispose()
}

Write-Output $output
