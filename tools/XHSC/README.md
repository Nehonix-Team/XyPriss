# XyPriss System (Go Implementation)

Ce dossier contient la réécriture en **Golang** du cœur système de XyPriss (`xypriss-sys`), initialement écrit en Rust.

## Vision & Objectifs

L'objectif est de porter la robustesse et les performances de la version Rust vers Go, tout en bénéficiant de la simplicité de gestion des goroutines et du déploiement facilité.

## Comparaison des Modules (Rust vs Go)

| Module Rust           | Description                  | Equivalent Go / Bibliothèque                   |
| --------------------- | ---------------------------- | ---------------------------------------------- |
| `main.rs`             | Point d'entrée               | `cmd/xsys/main.go`                             |
| `cli.rs`              | Parsing des arguments CLI    | `internal/cli` (Cobra/Pflag)                   |
| `server/ipc.rs`       | Serveur IPC (Unix/Windows)   | `internal/ipc` (`net.Listen` sur unix/npipe)   |
| `server/router.rs`    | Routage des requêtes IPC     | `internal/router` (Pattern Matching ou Map)    |
| `handlers/`           | Logique des commandes        | `internal/handlers`                            |
| `fs.rs`               | Opérations fichiers avancées | `internal/fs` (standard `os`, `path/filepath`) |
| `sys.rs`              | Infos système & processus    | `internal/sys` (`gopsutil`)                    |
| `advanced_watcher.rs` | Surveillance de fichiers     | `internal/watcher` (`fsnotify`)                |
| `cluster/`            | Gestion des nœuds & workers  | `internal/cluster`                             |

## État de la Migration

- [x] Structure de base et CLI (Cobra)
- [x] Serveur IPC (Unix Sockets, protocole binaire [size][payload])
- [x] Router & Handlers de base (Sys, FS)
- [x] Opérations Système (Sysinfo via gopsutil)
- [x] Opérations Fichier (FS via stdlib)
- [x] Advanced Watcher (via fsnotify)
- [ ] Cluster Management (Manager/Worker spawn logic)

## Dépendances Clés (Go)

- **CLI**: [Cobra](https://github.com/spf13/cobra) (recommandé)
- **Système**: [gopsutil](https://github.com/shirou/gopsutil)
- **Watcher**: [fsnotify](https://github.com/fsnotify/fsnotify)
- **IPC**: Standard `net` (Unix) et [winio](https://github.com/Microsoft/go-winio) (Windows Named Pipes)
- **JSON**: Standard `encoding/json` ou `jsoniter` pour la perf.
- **Logging**: `zap` (Uber) ou standard `slog`.

## Comment Contribuer

1. Analyser le fichier Rust correspondant dans `tools/xypriss-sys/src`.
2. Implémenter la logique dans `internal/` en respectant les interfaces définies.
3. Tester la compatibilité avec le client TypeScript.

