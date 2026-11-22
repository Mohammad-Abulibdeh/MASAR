# Makes temporary voice clips with the Windows Arabic voice, one per line of voice_clips.tsv.
# Recorded clips with the same name (any of .mp3 .m4a .aac .ogg .opus .wav) replace them.
#   powershell -ExecutionPolicy Bypass -File MASAR_App\tools\make_voice_placeholders.ps1
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot '..\www\voice'
New-Item -ItemType Directory -Force $out | Out-Null

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await($op, [type]$type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    $task.Wait()
    $task.Result
}

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -like 'ar*' } | Select-Object -First 1
if (-not $voice) { throw 'No Arabic voice is installed in Windows.' }
$synth.Voice = $voice

foreach ($line in Get-Content (Join-Path $PSScriptRoot 'voice_clips.tsv') -Encoding UTF8) {
    if (-not $line.Trim()) { continue }
    $name, $text = $line.Split("`t", 2)
    if (Get-ChildItem $out -Filter "$name.*" | Where-Object { $_.Extension -ne '.wav' }) { continue }  # a recording exists
    $stream = Await ($synth.SynthesizeTextToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
    $size = [uint32]$stream.Size
    $null = Await ($reader.LoadAsync($size)) ([uint32])
    $bytes = New-Object byte[] $size
    $reader.ReadBytes($bytes)
    [IO.File]::WriteAllBytes((Join-Path $out "$name.wav"), $bytes)
}
"Voice: $($voice.DisplayName). Clips in $out"
