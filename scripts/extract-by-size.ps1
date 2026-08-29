$root = 'C:\Users\Owner\Desktop\DedeLamLatest'
$file = Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.docx' | Where-Object { $_.Length -eq 122621 } | Select-Object -First 1
if (-not $file) { throw 'source not found' }
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $null
try {
  $doc = $word.Documents.Open($file.FullName, $false, $true)
  [IO.File]::WriteAllText('C:\Users\Owner\Desktop\uniform-pos-app-CURRENT\hotong-2026-source.txt', $doc.Content.Text, [Text.UTF8Encoding]::new($false))
  Write-Output $file.FullName
} finally {
  if ($doc) { $doc.Close() }
  $word.Quit()
}
