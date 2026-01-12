#!/bin/bash

if [ $# -ne 1 ]; then
    echo "Usage: $0 <nombre_commits>"
    exit 1
fi

N=$1
FILE="tmp_changes.txt"

echo "$N commits en cours..."

for i in $(seq 1 $N); do
    echo "Commit $i/$N"
    
    # Sauvegarde état actuel
    cp -f "$FILE" "$FILE.bak" 2>/dev/null || true
    
    # Petite modification
    echo "Changement #$i - $(date)" > "$FILE"
    
    # Git add et commit
    git add "$FILE"
    git commit -m "Simu commit #$i: mod tmp file" || break
    
    # Supprime le fichier pour cycle propre (optionnel)
    # rm -f "$FILE"
done

echo "Fini ! $N commits créés. Vérifie avec 'git log --oneline'."

