# deploy.ps1
$RepoPath = "C:\Users\avcii\websites\infraone-digitalsignage"

Write-Host "Starte Deploy..."
Set-Location $RepoPath

# Änderungen holen
git fetch --all
git pull --rebase

# Änderungen hinzufügen
git add -A

# Nur committen, wenn Änderungen vorhanden sind
$changes = git status --porcelain
if (-not [string]::IsNullOrWhiteSpace($changes)) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm"
    git commit -m "Auto-Deploy $ts"
    Write-Host "Commit erstellt."
}
else {
    Write-Host "Keine Änderungen – nichts zu committen."
}

# Push
$branch = (git rev-parse --abbrev-ref HEAD)
git push origin $branch

Write-Host "Deploy abgeschlossen! Netlify baut jetzt."
