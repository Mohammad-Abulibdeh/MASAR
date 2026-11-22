# Builds MASAR.apk with Gradle from android/ and www/. Needs the Android SDK; the JDK and Gradle
# live in E:\Mtech\MASAR_tools, and everything Gradle downloads stays there too (drive C is small).
#   powershell -ExecutionPolicy Bypass -File MASAR_App\build.ps1
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$tools = 'E:\Mtech\MASAR_tools'
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$env:JAVA_HOME = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\javac.exe")) { $env:JAVA_HOME } else { (Get-ChildItem "$tools\jdk" -Directory)[0].FullName }
$env:GRADLE_USER_HOME = "$tools\gradle-home"
New-Item -ItemType Directory -Force "$tools\tmp" | Out-Null
$env:TEMP = "$tools\tmp"
$env:TMP = "$tools\tmp"
$env:JAVA_TOOL_OPTIONS = "-Djava.io.tmpdir=$tools\tmp"
$gradle = (Get-ChildItem "$tools\gradle" -Directory)[0].FullName + '\bin\gradle.bat'

Set-Content "$here\android\local.properties" ('sdk.dir=' + $sdk.Replace('\', '\\').Replace(':', '\:')) -Encoding ascii
Push-Location "$here\android"
try {
    & $gradle --console=plain -q assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "Gradle failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}
Copy-Item (Get-ChildItem "$here\android\build\outputs\apk\release" -Filter *.apk)[0].FullName "$here\MASAR.apk"
"Built $here\MASAR.apk ($([math]::Round((Get-Item "$here\MASAR.apk").Length / 1MB, 2)) MB)"
