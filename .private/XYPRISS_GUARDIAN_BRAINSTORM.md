# Prydam (XyPriss Daemon Process Manager)

## Brainstorming & Architecture Design

> **Vision**: Un gestionnaire de processus ultra-performant et intelligent, spécialement conçu pour XyPriss, qui garantit une disponibilité 99.99% en production.

---

## 📛 Nom du Projet - DÉCISIONS

**Options considérées:**

1. **Prydam** ✅ CHOIX PRINCIPAL
    - **Prononciation**: "pri-dam" (comme "prime dame")
    - **Origine**: **Pry**ss + **Da**e**m**on
    - **Avantages**: Court, mémorable, évoque la technologie premium
2. **XyDPM** (XyPriss Daemon Process Manager)
    - Descriptif mais moins mémorable
3. **XyPriss-DPMP** (XyPriss Daemon Process Manager Plugin)
    - Trop long, moins élégant

**RECOMMANDATION FINALE: Prydam**

-   Package npm: `@xypriss/prydam`
-   CLI: `prydam`
-   Binaire: `prydam-linux-x64`

---

## 🎯 Décisions Techniques Clés

### 1. Langage: Rust ✅

**Pourquoi Rust:**

-   Performance maximale (critique pour un process manager)
-   Binaire standalone (pas de dépendance Node.js)
-   Sécurité mémoire garantie
-   Excellent pour les outils système Linux
-   Apprentissage ensemble (opportunité de croissance)

**Architecture hybride:**

```
┌─────────────────────────────────────────────┐
│  Prydam Architecture                        │
├─────────────────────────────────────────────┤
│                                             │
│  [XyPriss App]                             │
│       ↓                                     │
│  [Plugin.exec()] ← TypeScript/Node.js      │
│       ↓                                     │
│  [Prydam CLI Wrapper] ← Node.js script     │
│       ↓                                     │
│  [Prydam Core] ← Rust binary               │
│       ↓                                     │
│  [systemd service] ← Linux daemon          │
│                                             │
└─────────────────────────────────────────────┘
```

### 2. Intégration XyPriss via Plugin API

**Point d'entrée:**

```typescript
// Dans votre serveur XyPriss
import { Plugin } from "xypriss";
import { PrydamPlugin } from "@xypriss/prydam";

Plugin.exec(
    PrydamPlugin.use({
        strategy: "hot",
        clones: 2,
        resources: {
            memory: "1G",
            cpu: 80,
        },
    })
);
```

**Le plugin:**

-   S'enregistre via `Plugin.exec()` (alias de `Plugin.register()`)
-   Hook `onServerStart`: Lance le daemon Rust en arrière-plan
-   Hook `onServerReady`: Enregistre le serveur comme "healthy clone"
-   Hook `onServerStop`: Nettoie les ressources

### 3. Systemd Integration ✅

**Service systemd automatique:**

```ini
[Unit]
Description=Prydam - XyPriss Daemon Process Manager
After=network.target

[Service]
Type=forking
ExecStart=/usr/local/bin/prydam daemon --config /etc/prydam/config.toml
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=3
KillMode=process
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

**Fonctionnalités:**

-   Démarrage automatique au boot
-   Redémarrage automatique si crash
-   Gestion gracieuse des signaux
-   Logs dans journald

### 4. Gestion des Signaux

**CTRL+C (SIGINT) Behavior:**

```rust
// Dans le CLI wrapper
signal_handler::register(Signal::SIGINT, || {
    println!("Detaching from Prydam daemon...");
    // Quitte le CLI mais laisse le daemon tourner
    std::process::exit(0);
});

// Dans le daemon
signal_handler::register(Signal::SIGTERM, || {
    // Graceful shutdown de tous les clones
    shutdown_gracefully();
});
```

**Comportement:**

-   `CTRL+C` → Quitte le CLI, daemon continue
-   `prydam stop` → Arrêt gracieux du daemon
-   `systemctl stop prydam` → Arrêt complet

---

## 🎯 Problème Identifié

**Situation actuelle avec PM2:**

-   PM2 crash parfois avec XyPriss
-   Quand le serveur crash, les utilisateurs sont impactés
-   Temps de récupération trop long
-   Pas optimisé pour XyPriss spécifiquement

**Impact:**

-   Downtime = perte d'utilisateurs
-   Expérience utilisateur dégradée
-   Stress pour le développeur

---

## 💡 Solution Proposée: XyPriss Guardian

### Concept Core

Un plugin/outil qui remplace PM2 mais **optimisé exclusivement pour XyPriss** avec:

-   Isolation complète des processus
-   Système de clones "hot standby"
-   Basculement automatique instantané
-   Build optimisé et intelligent
-   Monitoring avancé

---

## 🏗️ Architecture Technique

### 1. **Build System Intelligent**

```
┌─────────────────────────────────────────┐
│  XyPriss Guardian Build Engine          │
├─────────────────────────────────────────┤
│ • Analyse du point d'entrée             │
│ • Détection automatique des dépendances │
│ • Tree-shaking agressif                 │
│ • Bundling optimisé                     │
│ • Minification + compression            │
│ • Cache intelligent                     │
└─────────────────────────────────────────┘
```

**Fonctionnalités:**

-   Analyse statique du code pour détecter toutes les dépendances
-   Exclusion configurable (node_modules spécifiques, dev dependencies)
-   Build incrémental (rebuild seulement ce qui change)
-   Génération d'un bundle standalone exécutable
-   Optimisations spécifiques XyPriss (pre-compilation des routes, etc.)

**Configuration:**

```typescript
// guardian.config.ts
export default {
    build: {
        entry: "./src/server.ts",
        exclude: ["@types/*", "devDependencies"],
        optimize: {
            treeShaking: true,
            minify: true,
            precompile: true, // XyPriss-specific
        },
        output: ".guardian/builds",
    },
};
```

---

### 2. **Clone Management System**

```
┌──────────────────────────────────────────────────────┐
│              Clone Lifecycle                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [Build] → [Validate] → [Standby] → [Active]        │
│                ↓           ↓           ↓             │
│            [Failed]    [Ready]    [Crashed]          │
│                                       ↓              │
│                                  [Replace]           │
│                                       ↓              │
│                              [Create New Clone]      │
└──────────────────────────────────────────────────────┘
```

**Structure d'un Clone:**

```typescript
interface ServerClone {
    id: string; // UUID unique
    status: "building" | "validating" | "standby" | "active" | "crashed";
    metadata: {
        createdAt: number;
        port: number; // Port du serveur
        originalPort: number; // Port du serveur original
        pid?: number; // Process ID
        memory: {
            limit: string; // '512M', '1G', etc.
            current?: number;
        };
        cpu: {
            limit?: number; // Percentage
            current?: number;
        };
    };
    buildPath: string; // Chemin vers le build
    logs: {
        stdout: string;
        stderr: string;
        crashes: CrashLog[];
    };
    healthCheck: {
        endpoint: string;
        interval: number;
        timeout: number;
        failureThreshold: number;
    };
}

interface CrashLog {
    timestamp: number;
    error: Error;
    stackTrace: string;
    systemInfo: {
        memory: NodeJS.MemoryUsage;
        uptime: number;
        loadAvg: number[];
    };
    requestContext?: any; // Dernière requête avant crash
}
```

---

### 3. **Process Isolation & Monitoring**

**Isolation Techniques:**

-   Chaque clone dans un processus Node.js séparé
-   Utilisation de `child_process.fork()` avec IPC
-   Isolation mémoire complète
-   Namespace Linux (optionnel, pour isolation avancée)
-   cgroups pour limites CPU/RAM

**Monitoring en Temps Réel:**

```typescript
interface MonitoringMetrics {
    process: {
        pid: number;
        uptime: number;
        memory: NodeJS.MemoryUsage;
        cpu: number;
    };
    server: {
        requestsPerSecond: number;
        averageResponseTime: number;
        activeConnections: number;
        errorRate: number;
    };
    health: {
        status: "healthy" | "degraded" | "critical";
        lastCheck: number;
        consecutiveFailures: number;
    };
}
```

---

### 4. **Automatic Failover System**

```
┌─────────────────────────────────────────────────────┐
│           Failover Workflow                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Crash Detection (< 100ms)                      │
│     ↓                                               │
│  2. Log Capture & Analysis                         │
│     ↓                                               │
│  3. Activate Standby Clone (< 500ms)               │
│     ↓                                               │
│  4. Port Binding Transfer                          │
│     ↓                                               │
│  5. Traffic Redirection (seamless)                 │
│     ↓                                               │
│  6. Cleanup Crashed Process                        │
│     ↓                                               │
│  7. Create New Standby Clone                       │
│     ↓                                               │
│  8. Notification & Logging                         │
└─────────────────────────────────────────────────────┘
```

**Objectif de Performance:**

-   Détection du crash: **< 100ms**
-   Basculement complet: **< 500ms**
-   Downtime total: **< 1 seconde**

---

### 5. **Smart Clone Strategy**

**Stratégies de Clonage:**

1. **Hot Standby (Défaut)**

    - 1 serveur actif + 1 clone en standby
    - Le clone est déjà démarré et prêt
    - Basculement instantané

2. **Warm Standby**

    - 1 serveur actif + build prêt
    - Clone démarré seulement au crash
    - Économie de ressources

3. **Multi-Clone**
    - 1 serveur actif + N clones en standby
    - Pour haute disponibilité critique
    - Load balancing possible

**Configuration:**

```typescript
cloneStrategy: {
  mode: 'hot' | 'warm' | 'multi',
  count: 1,              // Nombre de clones
  autoScale: {
    enabled: true,
    minClones: 1,
    maxClones: 3,
    scaleUpThreshold: 0.8,  // CPU/Memory
    scaleDownThreshold: 0.3
  }
}
```

---

## 🛠️ Choix Technologiques

### Langage de Développement

**Option 1: TypeScript/Node.js** ✅ RECOMMANDÉ

-   **Avantages:**
    -   Même écosystème que XyPriss
    -   Accès direct aux APIs Node.js
    -   Facilité d'intégration
    -   Communauté XyPriss familière
-   **Inconvénients:**
    -   Performance légèrement inférieure à des langages compilés
    -   Dépendance à Node.js runtime

**Option 2: Rust** 🚀 POUR LE FUTUR

-   **Avantages:**
    -   Performance maximale
    -   Sécurité mémoire
    -   Binaire standalone (pas de runtime)
    -   Très faible overhead
-   **Inconvénients:**
    -   Courbe d'apprentissage
    -   Intégration plus complexe
    -   Communauté moins familière

**Option 3: Go**

-   **Avantages:**
    -   Excellent pour les outils système
    -   Binaire standalone
    -   Concurrence native
    -   Compilation rapide
-   **Inconvénients:**
    -   Moins d'intégration avec Node.js
    -   Écosystème différent

**RECOMMANDATION:**

-   **Phase 1 (MVP)**: TypeScript/Node.js
    -   Développement rapide
    -   Intégration facile avec XyPriss
    -   Package npm simple
-   **Phase 2 (Optimisation)**: Rust
    -   Réécriture du core en Rust
    -   Bindings Node.js via NAPI
    -   Performance maximale

---

### Distribution

**Option 1: Package npm** ✅ RECOMMANDÉ POUR DÉBUT

```bash
npm install -g @xypriss/guardian
xypriss-guardian start ./server.ts
```

**Option 2: Binaire Linux Standalone** 🎯 OBJECTIF FINAL

```bash
# Installation
curl -fsSL https://guardian.xypriss.com/install.sh | sh

# Utilisation
guardian start ./server.ts
guardian status
guardian restart
guardian logs
```

**Structure du Binaire:**

-   Compilé avec `pkg` (Node.js) ou natif (Rust)
-   Inclut toutes les dépendances
-   Taille optimisée (< 50MB)
-   Auto-update intégré

---

## 📋 Fonctionnalités Détaillées

### 1. CLI Interface

```bash
# Démarrage
guardian start [entry-file] [options]
  --port <port>           # Port du serveur
  --clones <count>        # Nombre de clones
  --strategy <mode>       # hot|warm|multi
  --memory <limit>        # Limite mémoire par clone
  --cpu <limit>           # Limite CPU
  --config <file>         # Fichier de configuration

# Gestion
guardian status           # État de tous les clones
guardian restart [id]     # Redémarrer un clone
guardian stop [id]        # Arrêter un clone
guardian logs [id]        # Voir les logs
guardian health           # Health check

# Monitoring
guardian monitor          # Dashboard en temps réel
guardian metrics          # Métriques détaillées
guardian crashes          # Historique des crashes

# Maintenance
guardian cleanup          # Nettoyer les anciens builds
guardian update           # Mettre à jour Guardian
guardian doctor           # Diagnostic du système
```

### 2. Configuration File

```typescript
// guardian.config.ts
export default {
    // Build configuration
    build: {
        entry: "./src/server.ts",
        output: ".guardian/builds",
        exclude: ["@types/*"],
        optimize: true,
        cache: true,
    },

    // Clone strategy
    clones: {
        strategy: "hot",
        count: 2,
        autoScale: {
            enabled: true,
            minClones: 1,
            maxClones: 5,
        },
    },

    // Resource limits
    resources: {
        memory: "1G",
        cpu: 80, // percentage
    },

    // Health checks
    health: {
        endpoint: "/health",
        interval: 5000,
        timeout: 3000,
        failureThreshold: 3,
    },

    // Crash handling
    crash: {
        autoRestart: true,
        maxRestarts: 10,
        restartDelay: 1000,
        logPath: ".guardian/crashes",
        notifyOnCrash: {
            email: "dev@example.com",
            webhook: "https://...",
        },
    },

    // Logging
    logging: {
        level: "info",
        stdout: ".guardian/logs/stdout.log",
        stderr: ".guardian/logs/stderr.log",
        rotate: {
            maxSize: "100M",
            maxFiles: 10,
        },
    },

    // Advanced
    advanced: {
        useNamespaces: false, // Linux namespaces
        useCgroups: true, // Resource isolation
        gracefulShutdown: 30000,
    },
};
```

### 3. Programmatic API

```typescript
import { Guardian } from "@xypriss/guardian";

const guardian = new Guardian({
    entry: "./server.ts",
    clones: { strategy: "hot", count: 2 },
});

// Events
guardian.on("clone:created", (clone) => {
    console.log(`Clone ${clone.id} created`);
});

guardian.on("clone:crashed", (clone, error) => {
    console.error(`Clone ${clone.id} crashed:`, error);
});

guardian.on("failover:started", (from, to) => {
    console.log(`Failover from ${from.id} to ${to.id}`);
});

guardian.on("failover:completed", (duration) => {
    console.log(`Failover completed in ${duration}ms`);
});

// Control
await guardian.start();
await guardian.stop();
await guardian.restart();

// Monitoring
const metrics = guardian.getMetrics();
const health = guardian.getHealth();
const crashes = guardian.getCrashHistory();
```

---

## 🔒 Sécurité & Isolation

### Process Isolation

```typescript
// Utilisation de child_process avec isolation
const clone = fork(buildPath, [], {
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    detached: false,
    env: {
        ...process.env,
        NODE_ENV: "production",
        GUARDIAN_CLONE_ID: cloneId,
    },
    execArgv: [`--max-old-space-size=${memoryLimit}`, "--expose-gc"],
});
```

### Linux Namespaces (Optionnel)

-   PID namespace: Isolation des processus
-   Network namespace: Isolation réseau
-   Mount namespace: Isolation du système de fichiers
-   IPC namespace: Isolation de la communication inter-processus

### Resource Limits (cgroups)

```bash
# Création d'un cgroup pour chaque clone
cgcreate -g memory,cpu:/guardian/clone-${id}

# Limites mémoire
echo ${memoryLimit} > /sys/fs/cgroup/memory/guardian/clone-${id}/memory.limit_in_bytes

# Limites CPU
echo ${cpuLimit} > /sys/fs/cgroup/cpu/guardian/clone-${id}/cpu.shares
```

---

## 📊 Monitoring & Observability

### Dashboard Web (Optionnel)

```
┌────────────────────────────────────────────────┐
│  XyPriss Guardian Dashboard                   │
├────────────────────────────────────────────────┤
│                                                │
│  Active Clone: clone-abc123                   │
│  Status: ● Healthy                             │
│  Uptime: 5d 12h 34m                           │
│  Memory: 450MB / 1GB (45%)                    │
│  CPU: 23%                                      │
│  Requests/s: 1,234                            │
│                                                │
│  Standby Clones: 2                            │
│  ├─ clone-def456 (Ready)                      │
│  └─ clone-ghi789 (Ready)                      │
│                                                │
│  Recent Events:                               │
│  • 12:34:56 - Clone created                   │
│  • 12:30:12 - Failover completed (450ms)      │
│  • 11:45:23 - Crash detected                  │
│                                                │
└────────────────────────────────────────────────┘
```

### Metrics Export

-   Prometheus format
-   StatsD support
-   Custom webhooks
-   Log aggregation (ELK, Loki)

---

## 🚀 Roadmap de Développement

### Phase 1: MVP (2-3 mois)

-   [ ] Build system basique
-   [ ] Clone management simple
-   [ ] Crash detection
-   [ ] Failover automatique
-   [ ] CLI basique
-   [ ] Package npm

### Phase 2: Production Ready (3-4 mois)

-   [ ] Health checks avancés
-   [ ] Monitoring complet
-   [ ] Dashboard web
-   [ ] Auto-scaling
-   [ ] Notifications
-   [ ] Documentation complète

### Phase 3: Optimisation (4-6 mois)

-   [ ] Réécriture du core en Rust
-   [ ] Binaire standalone
-   [ ] Performance maximale
-   [ ] Linux namespaces
-   [ ] Intégration cloud (Docker, K8s)

---

## 💰 Modèle de Distribution

### Open Source (Core)

-   Fonctionnalités de base gratuites
-   MIT License
-   Communauté active

### Premium Features (Optionnel)

-   Dashboard web avancé
-   Intégrations cloud
-   Support prioritaire
-   Fonctionnalités entreprise

---

## 🎯 Nom du Projet

**Suggestions:**

1. **XyPriss Guardian** ✅ (Protection, fiabilité)
2. **XyPriss Sentinel** (Surveillance, garde)
3. **XyPriss Phoenix** (Renaissance après crash)
4. **XyPriss Immortal** (Jamais mort)
5. **XyPriss Fortress** (Forteresse, sécurité)

**RECOMMANDATION: XyPriss Guardian**

-   Évoque la protection
-   Facile à retenir
-   Professionnel

---

## 📝 Conclusion & Prochaines Étapes

### Faisabilité: ✅ TRÈS FAISABLE

-   Technologie mature (Node.js/Rust)
-   Problème réel et important
-   Marché existant (alternative à PM2)
-   Intégration XyPriss native

### Performance: ✅ EXCELLENTE

-   Failover < 1 seconde
-   Overhead minimal
-   Isolation complète
-   Monitoring en temps réel

### Valeur Ajoutée: 🌟 ÉNORME

-   Résout un vrai problème
-   Optimisé pour XyPriss
-   Open source = communauté
-   Potentiel commercial

### Prochaines Actions:

1. Valider l'architecture avec la communauté
2. Créer un POC (Proof of Concept)
3. Tester avec des serveurs XyPriss réels
4. Itérer sur le design
5. Développer le MVP

---

**Date**: 2025-12-12  
**Auteur**: Nehonix Team  
**Status**: Brainstorming - Ready for POC

