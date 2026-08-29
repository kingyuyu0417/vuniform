$root = 'C:\Users\Owner\Desktop\DedeLamLatest'
$out = 'C:\Users\Owner\Desktop\uniform-pos-app-CURRENT\latest-doc-audit.json'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$results = @()
try {
  $files = Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.docx' | Sort-Object FullName
  foreach ($file in $files) {
    $doc = $null
    try {
      $doc = $word.Documents.Open($file.FullName, $false, $true)
      $text = $doc.Content.Text
      $priceCount = [regex]::Matches($text, '\$\s*[0-9]+').Count
      $headingCount = [regex]::Matches($text, '(?:男生|女生|男女生|男童|女童|男女童)\s*[-–—:：]?').Count
      $results += [ordered]@{
        file = $file.FullName.Substring($root.Length + 1)
        modified = $file.LastWriteTime.ToString('yyyy-MM-dd')
        textLength = $text.Length
        priceCount = $priceCount
        headingCount = $headingCount
      }
    } catch {
      $results += [ordered]@{ file = $file.FullName.Substring($root.Length + 1); error = $_.Exception.Message }
    } finally {
      if ($doc) { $doc.Close(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null }
    }
  }
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $out -Encoding UTF8
$results | Select-Object file,priceCount,headingCount,textLength | Format-Table -AutoSize
Write-Output "REPORT=$out FILES=$($results.Count)"
