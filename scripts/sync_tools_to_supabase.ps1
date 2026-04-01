param(
  [string]$ToolsPath = "app/backend/mock_data/tools.json",
  [int]$BatchSize = 100
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $ToolsPath)) {
  throw "Tools dataset not found at $ToolsPath"
}

$tools = Get-Content $ToolsPath -Raw | ConvertFrom-Json
if (@($tools).Count -eq 0) {
  throw "Tools dataset is empty: $ToolsPath"
}

$supabaseUrl = $env:SUPABASE_URL
$serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY

if ([string]::IsNullOrWhiteSpace($supabaseUrl)) {
  throw "Missing required environment variable: SUPABASE_URL"
}
if ([string]::IsNullOrWhiteSpace($serviceKey)) {
  throw "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY"
}

$sourceCount = @($tools).Count
Write-Host ("sync_start total_source_tools={0} batch_size={1}" -f $sourceCount, $BatchSize)
Write-Host "auth_mode=service_role"

# Normalize and deduplicate by slug before batching.
$bySlug = @{}
$clean = New-Object System.Collections.Generic.List[object]
foreach ($tool in $tools) {
  $rawSlug = if ($null -eq $tool.slug) { "" } else { [string]$tool.slug }
  $slug = $rawSlug.Trim().ToLower()
  if ([string]::IsNullOrWhiteSpace($slug)) { continue }
  if ($bySlug.ContainsKey($slug)) { continue }

  $toolObj = [pscustomobject]@{}
  foreach ($p in $tool.PSObject.Properties) {
    Add-Member -InputObject $toolObj -MemberType NoteProperty -Name $p.Name -Value $p.Value
  }

  # Backward-compatible field mapping:
  # accept camelCase `url` / `affiliateUrl` and map to DB snake_case columns.
  if (
    ($toolObj.PSObject.Properties.Name -contains 'url') -and
    -not ($toolObj.PSObject.Properties.Name -contains 'website_url')
  ) {
    Add-Member -InputObject $toolObj -MemberType NoteProperty -Name 'website_url' -Value $toolObj.url
  }

  if (
    ($toolObj.PSObject.Properties.Name -contains 'affiliateUrl') -and
    -not ($toolObj.PSObject.Properties.Name -contains 'affiliate_url')
  ) {
    Add-Member -InputObject $toolObj -MemberType NoteProperty -Name 'affiliate_url' -Value $toolObj.affiliateUrl
  }

  $toolObj.slug = $slug

  $bySlug[$slug] = $true
  $clean.Add($toolObj)
}

$headers = @{
  apikey = $serviceKey
  Authorization = "Bearer $serviceKey"
  Prefer = "resolution=merge-duplicates,return=minimal"
  "Content-Type" = "application/json"
}

$upsertUri = "$supabaseUrl/rest/v1/tools?on_conflict=slug"
$inserted = 0

$allowedColumns = @(
  'name','slug','short_description','full_description','category','subcategory','tags','pricing_model',
  'starting_price','skill_level','website_url','affiliate_url','logo_url','internal_score','is_featured','pros','cons',
  'best_use_cases','tool_type','active','use_cases','target_audience','difficulty_score',
  'recommended_for','popularity_score','beginner_friendly'
)
$dbManagedColumns = @('id', 'created_at', 'updated_at')
$printedPayloadKeys = $false

function Get-FullErrorBody {
  param(
    [Parameter(Mandatory = $true)]
    $ErrorRecord
  )

  $bodyParts = New-Object System.Collections.Generic.List[string]

  if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
    $bodyParts.Add([string]$ErrorRecord.ErrorDetails.Message)
  }

  if ($ErrorRecord.Exception -and $ErrorRecord.Exception.Response) {
    try {
      $response = $ErrorRecord.Exception.Response
      $stream = $response.GetResponseStream()
      if ($null -ne $stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $streamBody = $reader.ReadToEnd()
        if (-not [string]::IsNullOrWhiteSpace($streamBody)) {
          $bodyParts.Add($streamBody)
        }
      }
    }
    catch {
      # Best-effort diagnostics only.
    }
  }

  if ($bodyParts.Count -gt 0) {
    return ($bodyParts -join "`n")
  }

  if ($ErrorRecord.Exception -and $ErrorRecord.Exception.Message) {
    return [string]$ErrorRecord.Exception.Message
  }

  return "Unknown error"
}

for ($i = 0; $i -lt $clean.Count; $i += $BatchSize) {
  $chunk = $clean[$i..([Math]::Min($i + $BatchSize - 1, $clean.Count - 1))]
  $batchSlugSample = @($chunk | Select-Object -First 5 | ForEach-Object { $_.slug })

  $batchBySlug = @{}
  $dedupedChunk = New-Object System.Collections.Generic.List[object]
  foreach ($tool in $chunk) {
    $slug = if ($null -eq $tool.slug) { "" } else { ([string]$tool.slug).Trim().ToLower() }
    if ([string]::IsNullOrWhiteSpace($slug)) { continue }
    if ($batchBySlug.ContainsKey($slug)) { continue }
    $batchBySlug[$slug] = $true
    $dedupedChunk.Add($tool)
  }

  $payload = foreach ($tool in $dedupedChunk) {
    $row = [ordered]@{}
    foreach ($col in $allowedColumns) {
      if ($tool.PSObject.Properties.Name -contains $col) {
        $row[$col] = $tool.$col
      }
    }

    foreach ($managedCol in $dbManagedColumns) {
      if ($null -ne $row[$managedCol]) {
        $null = $row.Remove($managedCol)
      }
    }

    if ($null -ne $row['slug'] -and [string]$row['slug'] -ne '') {
      $row['slug'] = ([string]$row['slug']).Trim().ToLower()
    }
    [pscustomobject]$row
  }

  $payloadRows = @($payload)
  $payloadCount = $payloadRows.Count

  if (-not $printedPayloadKeys) {
    $firstPayloadRow = $payloadRows | Select-Object -First 1
    if ($null -ne $firstPayloadRow) {
      $payloadKeys = @($firstPayloadRow.PSObject.Properties.Name) -join ','
      Write-Host ("payload_first_row_keys={0}" -f $payloadKeys)
      $sampleRowJson = @($firstPayloadRow) | ConvertTo-Json -Depth 10 -Compress
      Write-Host ("payload_sample_row={0}" -f $sampleRowJson)
    }
    $printedPayloadKeys = $true
  }

  $rowsMissingSlug = @($payloadRows | Where-Object { $null -eq $_.slug -or [string]::IsNullOrWhiteSpace([string]$_.slug) }).Count
  $rowsWithId = @($payloadRows | Where-Object { $_.PSObject.Properties.Name -contains 'id' -and $null -ne $_.id }).Count
  Write-Host ("payload_count={0} rows_missing_slug={1} rows_with_id={2}" -f $payloadCount, $rowsMissingSlug, $rowsWithId)

  if ($rowsMissingSlug -gt 0) {
    throw ("Payload validation failed: {0} rows missing slug" -f $rowsMissingSlug)
  }
  if ($rowsWithId -gt 0) {
    throw ("Payload validation failed: {0} rows still contain id" -f $rowsWithId)
  }

  $json = $payloadRows | ConvertTo-Json -Depth 10 -Compress

  try {
    Invoke-RestMethod -Method Post -Uri $upsertUri -Headers $headers -Body $json | Out-Null
    $inserted += $dedupedChunk.Count
    Write-Host ("batch_ok start={0} size={1}" -f $i, $dedupedChunk.Count)
  }
  catch {
    $batchSizeValue = $dedupedChunk.Count
    $slugSample = @($batchSlugSample | Select-Object -First 5) -join ','
    Write-Host ("batch_failed start={0} size={1}" -f $i, $batchSizeValue)
    Write-Host ("batch_slug_sample={0}" -f $slugSample)
    $statusCode = $null
    $errorBody = $null

    if ($_.Exception -and $_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }

    $errorBody = Get-FullErrorBody -ErrorRecord $_

    if ($null -ne $errorBody -and $errorBody -ne '') {
      Write-Host ("error_body={0}" -f $errorBody)
    } elseif ($_.Exception -and $_.Exception.Message) {
      Write-Host ("error_message={0}" -f $_.Exception.Message)
    }

    Write-Host ("error_body_raw={0}" -f $errorBody)

    if ($statusCode -eq 409 -and ($null -eq $errorBody -or $errorBody -eq '')) {
      Write-Host "error_body=HTTP 409 Conflict (no response body available)"
    }
    throw
  }
}

# Validate final state from Supabase.
$readHeaders = @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" }
$rows = Invoke-RestMethod -Method Get -Uri "$supabaseUrl/rest/v1/tools?select=category,slug,name&active=eq.true&limit=5000" -Headers $readHeaders
$total = @($rows).Count
$dupSlug = (@($rows | Group-Object slug | Where-Object { $_.Count -gt 1 })).Count
$dupName = (@($rows | Group-Object { if ($null -ne $_.name) { ([string]$_.name).ToLower() } else { '' } } | Where-Object { $_.Count -gt 1 })).Count

Write-Host "ACTIVE_TOTAL=$total"
Write-Host "DUP_SLUG_GROUPS=$dupSlug"
Write-Host "DUP_NAME_GROUPS=$dupName"
$rows | Group-Object category | Sort-Object Name | ForEach-Object {
  Write-Host ("CATEGORY_{0}={1}" -f $_.Name.ToUpper(), $_.Count)
}
