$root = if ($args.Count -gt 0) { $args[0] } else { 'C:\Users\Owner\Desktop\DedeLamLatest' }
$out = if ($args.Count -gt 1) { $args[1] } else { Join-Path $PSScriptRoot '..\src\dedeLamLatestProducts.json' }
$manifest = if ($args.Count -gt 2) { $args[2] } else { Join-Path $PSScriptRoot '..\src\dedeLamPriceSources.json' }
Add-Type -AssemblyName System.IO.Compression.FileSystem

$catalog = @{}
foreach ($file in @('..\src\schoolCatalog.json', '..\src\workbookSchoolCatalog.json')) {
  $data = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot $file) | ConvertFrom-Json
  foreach ($property in $data.PSObject.Properties) { $catalog[$property.Name] = $property.Value }
}

function Read-DocxXml($file) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($file)
  try {
    $entry = $zip.GetEntry('word/document.xml')
    $reader = [IO.StreamReader]::new($entry.Open())
    try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
  } finally { $zip.Dispose() }
}

function Text-Of($node, $namespace) {
  return (($node.SelectNodes('.//w:t', $namespace) | ForEach-Object { $_.InnerText }) -join '').Trim()
}

$products = @()
$sources = @()
$files = Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.docx' | Where-Object { $_.Name -match '2026' } | Sort-Object LastWriteTime -Descending
foreach ($file in $files) {
  try {
    $xml = Read-DocxXml $file.FullName
    $namespace = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
    $namespace.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    $allText = (($xml.SelectNodes('//w:t', $namespace) | ForEach-Object { $_.InnerText }) -join ' ')
    $compactText = $allText -replace '\s+', ''
    $school = ($catalog.Keys | Where-Object { $compactName = $_ -replace '\s+', ''; $compactName.Length -gt 3 -and $compactText.Contains($compactName) } | Sort-Object Length -Descending | Select-Object -First 1)
    if (-not $school) { continue }
    $sources += [ordered]@{ school = $school; file = $file.FullName.Substring($root.Length + 1); date = $file.LastWriteTime.ToString('yyyy-MM-dd') }
    $lastParagraph = ''
    foreach ($node in $xml.SelectNodes('//w:body/*', $namespace)) {
      if ($node.LocalName -eq 'p') { $lastParagraph = Text-Of $node $namespace; continue }
      if ($node.LocalName -ne 'tbl') { continue }
      $rows = @()
      foreach ($row in $node.SelectNodes('./w:tr', $namespace)) {
        $cells = @()
        foreach ($cell in $row.SelectNodes('./w:tc', $namespace)) { $cells += (Text-Of $cell $namespace) }
        $rows += ,$cells
      }
      for ($rowIndex = 1; $rowIndex -lt $rows.Count; $rowIndex++) {
        $prices = @([regex]::Matches(($rows[$rowIndex] -join ' '), '\$\s*([0-9]+)') | ForEach-Object { [int]$_.Groups[1].Value })
        if ($prices.Count -eq 0) { continue }
        $sizes = @([regex]::Matches(($rows[$rowIndex - 1] -join ' '), '(?<![A-Za-z])(?:[0-9]+(?:\.[0-9]+)?(?:-[0-9]+)?(?:/(?:XS|S|M|L|XL|XXL|2XL))?|XS|S|M|L|XL|XXL|2XL|均碼)(?![A-Za-z])') | ForEach-Object { $_.Value })
        if ($sizes.Count -eq 0 -or $sizes.Count -ne $prices.Count -or -not $lastParagraph) { continue }
        $name = ($lastParagraph -replace '（[^）]*）|\([^)]*\)', '' -replace '\s+', ' ').Trim()
        if (-not $name) { continue }
        $products += [ordered]@{ id = 'dede-' + [guid]::NewGuid().ToString('N'); school = $school; name = $name; sizes = @($sizes | ForEach-Object -Begin { $i = 0 } -Process { [ordered]@{ size = $_; price = $prices[$i++] } }) }
        break
      }
    }
  } catch { }
}
$products = @($products | Group-Object { "$($_.school)|$($_.name)" } | ForEach-Object { $_.Group | Select-Object -First 1 })
$products | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $out -Encoding UTF8
$sources | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifest -Encoding UTF8
Write-Output "SOURCES=$($sources.Count) PRODUCTS=$($products.Count)"