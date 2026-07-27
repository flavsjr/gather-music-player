# Gera musicas/playlist.json a partir dos arquivos da pasta /musicas.
#
# O manifesto e opcional. Serve pra:
#   a) hospedar onde nao ha listagem de diretorio (ex: GitHub Pages)
#   b) corrigir titulo/artista quando o nome do arquivo engana
#
# Faixa sem correcao vira string simples (titulo/artista saem do nome do arquivo).
# Faixa com correcao vira objeto {file,title,artist} — e o script PRESERVA essas
# correcoes ao rodar de novo, entao pode editar o JSON a vontade.
#
# Uso:  powershell -ExecutionPolicy Bypass -File gerar-playlist.ps1

$pasta    = Join-Path $PSScriptRoot "musicas"
$destino  = Join-Path $pasta "playlist.json"
$exts     = @(".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".opus", ".webm")

# preserva as correcoes manuais do manifesto anterior
$overrides = @{}
if (Test-Path $destino) {
    try {
        # -Encoding UTF8 e obrigatorio: sem isso PS 5.1 le em ANSI e destroi acentos
        foreach ($item in (Get-Content $destino -Raw -Encoding UTF8 | ConvertFrom-Json)) {
            if ($item -isnot [string] -and $item.file) { $overrides[$item.file] = $item }
        }
    } catch {
        Write-Warning "playlist.json anterior invalido, sera recriado do zero."
    }
}

$arquivos = Get-ChildItem -Path $pasta -File |
    Where-Object { $exts -contains $_.Extension.ToLower() } |
    Sort-Object Name |
    ForEach-Object { $_.Name }

$entradas = foreach ($nome in $arquivos) {
    if ($overrides.ContainsKey($nome)) {
        [ordered]@{ file = $nome; title = $overrides[$nome].title; artist = $overrides[$nome].artist }
    } else {
        $nome
    }
}

$json = ConvertTo-Json @($entradas) -Depth 3
# UTF-8 sem BOM (BOM quebra JSON.parse em alguns consumidores)
[IO.File]::WriteAllText($destino, $json, (New-Object Text.UTF8Encoding($false)))

$corrigidas = @($entradas | Where-Object { $_ -isnot [string] }).Count
Write-Host "playlist.json gerado: $($arquivos.Count) faixa(s), $corrigidas com titulo/artista corrigido."
$arquivos | ForEach-Object { Write-Host "  - $_" }
