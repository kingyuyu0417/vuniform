$file = $args[0]
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
  $doc = $word.Documents.Open($file, $false, $true)
  $text = $doc.Content.Text
  $priceLines = @($text -split "`r?`n" | Where-Object { $_ -match '\$\s*[0-9]+' })
  $output = 'C:\Users\Owner\Desktop\uniform-pos-app-CURRENT\tuenmun-govt-2026-source.txt'
  [IO.File]::WriteAllText($output, $text, [Text.UTF8Encoding]::new($false))
  Write-Output "FILE=$file"
  Write-Output "TEXT_LENGTH=$($text.Length)"
  Write-Output "PRICE_LINES=$($priceLines.Count)"
  Write-Output "PRICE_COUNT=$([regex]::Matches($text, '\$\s*[0-9]+').Count)"
  Write-Output "OUTPUT=$output"
  $priceLines | Select-Object -First 40
} finally {
  if ($doc) { $doc.Close(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null }
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
