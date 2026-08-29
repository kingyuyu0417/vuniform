param([string]$File,[string]$Output)
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $null
try {
  $doc = $word.Documents.Open($File, $false, $true)
  [IO.File]::WriteAllText($Output, $doc.Content.Text, [Text.UTF8Encoding]::new($false))
} finally {
  if ($doc) { $doc.Close() }
  $word.Quit()
}
