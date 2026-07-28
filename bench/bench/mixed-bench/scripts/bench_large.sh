#!/bin/bash
set -e

# Capturé AVANT tout cd, pour résoudre les chemins relatifs passés par
# l'utilisateur (arg ou $LARGE_FILE) par rapport à l'endroit où il a lancé
# le script, et non par rapport au cwd interne du script.
ORIG_PWD="$(pwd)"
LARGE_FILE_INPUT="${1:-${LARGE_FILE:-}}"

# ==========================================
# CONFIG
# ==========================================
RESULTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/results"
mkdir -p "$RESULTS_DIR"

cd "$(dirname "$0")/../servers"
ASSETS_DIR="$(cd "../assets" && pwd)"

# Chemin réellement servi par /api/download sur les 3 serveurs.
# !! A AJUSTER si ton code serveur pointe ailleurs !!
SERVED_ASSET="$ASSETS_DIR/dummy-500k.bin"

# Fichier à utiliser pour ce run : 1er argument, ou variable d'env LARGE_FILE,
# sinon valeur par défaut. Les chemins relatifs sont résolus par rapport au
# répertoire depuis lequel le script a été lancé (ORIG_PWD), pas par rapport
# au cwd interne (servers/) après le cd ci-dessus.
if [ -n "$LARGE_FILE_INPUT" ]; then
  case "$LARGE_FILE_INPUT" in
    /*) LARGE_FILE="$LARGE_FILE_INPUT" ;;
    *)  LARGE_FILE="$ORIG_PWD/$LARGE_FILE_INPUT" ;;
  esac
else
  LARGE_FILE="$ASSETS_DIR/dummy-large.bin"
fi

# Niveaux de connexions à tester. Conservateur par défaut : 100 connexions x
# 1GB simultané n'a aucun sens réaliste et ne fait que produire des timeouts
# partout. Surchargeable : CONNS="1 5 10 20" ./bench_large.sh
CONNS="${CONNS:-1 3 5}"

# Nombre de requêtes par connexion à chaque niveau (mode "amount", pas
# "duration") : avec $CONNS connexions on envoie CONNS*REQS_PER_CONN requêtes
# au total puis on arrête, plutôt que de tourner un temps fixe et de compter
# ce qui a eu la chance de finir.
REQS_PER_CONN="${REQS_PER_CONN:-3}"

TIMEOUT="${TIMEOUT:-60}"     # secondes avant qu'une requête soit comptée en timeout

command -v bun >/dev/null 2>&1 || { echo "[!] bun not found"; exit 1; }
command -v autocannon >/dev/null 2>&1 || { echo "[!] autocannon not found. Run: npm i -g autocannon"; exit 1; }

if [ ! -f "$LARGE_FILE" ]; then
  echo "[!] Fichier introuvable : $LARGE_FILE"
  echo "    Crée-le d'abord, par ex. :"
  echo "    dd if=/dev/urandom of=\"$LARGE_FILE\" bs=1M count=2000   # ~2GB"
  exit 1
fi

# --- Taille détectée dynamiquement, aucun label en dur ---
SIZE_BYTES=$(stat -c%s "$LARGE_FILE" 2>/dev/null || stat -f%z "$LARGE_FILE")
SIZE_HUMAN=$(numfmt --to=iec --suffix=B "$SIZE_BYTES" 2>/dev/null || echo "${SIZE_BYTES}B")
SIZE_SLUG=$(echo "$SIZE_HUMAN" | tr -d ' ')

echo "##############################################"
echo "#   Mixed-Route Benchmark — large file ($SIZE_HUMAN)"
echo "##############################################"

ulimit -n 65535

# --- Swap du fichier servi, restauration garantie en sortie ---
BACKUP_FILE="${SERVED_ASSET}.bench_large_backup"
RESTORE_DONE=0

restore_asset() {
  if [ "$RESTORE_DONE" -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
    echo "[*] Restauration du fichier original : $SERVED_ASSET"
    mv -f "$BACKUP_FILE" "$SERVED_ASSET"
    RESTORE_DONE=1
  fi
}
trap restore_asset EXIT INT TERM

if [ -f "$SERVED_ASSET" ]; then
  cp -f "$SERVED_ASSET" "$BACKUP_FILE"
fi
cp -f "$LARGE_FILE" "$SERVED_ASSET"
echo "[*] $LARGE_FILE ($SIZE_HUMAN) servi à la place de $SERVED_ASSET pour ce run."

# Préchauffe le cache disque (page cache) une bonne fois pour toutes, AVANT
# de lancer le premier serveur. Sans ça, le premier framework testé hérite
# d'une lecture disque à froid alors que les suivants profitent du cache —
# faussant la comparaison entre Express/Fastify/XyPriss.
echo "[*] Préchauffage du cache disque..."
cat "$SERVED_ASSET" > /dev/null
echo ""

# ==========================================
# HELPERS
# ==========================================
wait_for_port() {
  local url="$1"
  for i in $(seq 1 50); do
    curl -sf "$url" -o /dev/null && return 0
    sleep 0.3
  done
  echo "[!] Le serveur n'a jamais répondu sur $url"
  return 1
}

cleanup_port() {
  lsof -ti:"$1" 2>/dev/null | xargs -r kill -9
}

# $1=name $2=port $3=stop_signal $4=boot_wait $5..=commande de démarrage
start_and_bench() {
  local name="$1" port="$2" stop_signal="$3" boot_wait="$4"
  shift 4
  local output="$RESULTS_DIR/${name}_${SIZE_SLUG}.txt"

  echo "[*] Running $name ($SIZE_HUMAN)..."
  {
    echo "=========================================="
    echo " Baseline: $name (Auth + $SIZE_HUMAN file)"
    echo "=========================================="
  } > "$output"

  cleanup_port "$port"

  echo "[*] Starting $name server..."
  "$@" &
  local SERVER_PID=$!

  if [ "$boot_wait" -gt 0 ]; then
    echo "[*] Sleeping ${boot_wait}s for startup..."
    sleep "$boot_wait"
  fi

  echo "[*] Waiting for port $port..."
  if ! wait_for_port "http://127.0.0.1:$port/api/download"; then
    kill -9 "$SERVER_PID" 2>/dev/null || true
    return 1
  fi

  echo "[*] Warmup (1 requête, juste pour vérifier que le serveur répond bien)..."
  autocannon -c 1 -a 1 -T "$TIMEOUT" "http://127.0.0.1:$port/api/download" > /dev/null

  for CONNS_N in $CONNS; do
    AMOUNT=$((CONNS_N * REQS_PER_CONN))
    echo "" >> "$output"
    echo "--- $CONNS_N connections, $AMOUNT requests ---" | tee -a "$output"
    echo "mem before: $(free -h | awk '/Mem:/ {print $3 " used / " $2 " total"}')" >> "$output"
    autocannon -c "$CONNS_N" -a "$AMOUNT" -T "$TIMEOUT" "http://127.0.0.1:$port/api/download" | tee -a "$output"
    echo "mem after:  $(free -h | awk '/Mem:/ {print $3 " used / " $2 " total"}')" >> "$output"
  done

  echo "[*] Stopping $name."
  kill "$stop_signal" "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  sleep 1
  echo "[*] Done. Results saved to $output"
  echo ""
}

# ==========================================
# RUNS
# ==========================================
start_and_bench "express" 8091 -9  0  node express.cjs
start_and_bench "fastify" 8092 -9  0  node fastify.cjs
start_and_bench "xypriss" 8093 -15 10 bun run xypriss.ts

restore_asset
trap - EXIT INT TERM

echo "##############################################"
echo "  All large-file ($SIZE_HUMAN) benchmarks complete."
echo "  Results saved in: results/"
for f in "$RESULTS_DIR"/*_"${SIZE_SLUG}".txt; do
  [ -f "$f" ] && echo "    - $f"
done
echo "##############################################"


















