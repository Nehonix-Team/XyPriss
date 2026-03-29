# Plan de Test Complet - XyPriss Plugin API

## Tests Critiques pour Prydam

> **Objectif**: Valider que l'API Plugin est 100% robuste et prête pour Prydam

---

## 🎯 Scénarios de Test Prioritaires

### 1. Test de Base - Plugin Simple ✅ FAIT

**Status**: Validé dans `.private/test_plugin_api.ts`

**Ce qui fonctionne:**

-   `Plugin.create()` crée un plugin
-   `Plugin.register()` enregistre le plugin
-   `Plugin.exec()` alias fonctionne
-   `Plugin.get()` récupère un plugin
-   Hooks `onServerStart` et `onServerReady` s'exécutent

---

### 2. Test de Lifecycle Hooks - CRITIQUE pour Prydam

**Scénario**: Valider que TOUS les hooks s'exécutent dans le bon ordre

```typescript
// test_lifecycle_hooks.ts
import { createServer, Plugin } from "../src";

let executionOrder: string[] = [];

const lifecyclePlugin = Plugin.create({
    name: "lifecycle-test",
    version: "1.0.0",

    onServerStart(server) {
        executionOrder.push("onServerStart");
        console.log("✓ onServerStart called");
    },

    onServerReady(server) {
        executionOrder.push("onServerReady");
        console.log("✓ onServerReady called");
    },

    onRequest(req, res, next) {
        executionOrder.push("onRequest");
        console.log("✓ onRequest called for:", req.url);
        next();
    },

    onResponse(req, res) {
        executionOrder.push("onResponse");
        console.log("✓ onResponse called for:", req.url);
    },

    onError(error, req, res, next) {
        executionOrder.push("onError");
        console.log("✓ onError called:", error.message);
        res.status(500).json({ error: "Handled by plugin" });
    },

    onServerStop(server) {
        executionOrder.push("onServerStop");
        console.log("✓ onServerStop called");
        console.log("Execution order:", executionOrder);
    },
});

Plugin.exec(lifecyclePlugin);

const app = createServer({});

app.get("/test", (req, res) => {
    res.json({ message: "OK" });
});

app.get("/error", (req, res) => {
    throw new Error("Test error");
});

app.start(8080, async () => {
    // Test request
    await fetch("http://localhost:8080/test");

    // Test error
    await fetch("http://localhost:8080/error");

    // Stop server
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});
```

**Validation:**

-   [ ] `onServerStart` s'exécute en premier
-   [ ] `onServerReady` s'exécute après
-   [ ] `onRequest` s'exécute pour chaque requête
-   [ ] `onResponse` s'exécute après chaque réponse
-   [ ] `onError` s'exécute sur les erreurs
-   [ ] `onServerStop` s'exécute à l'arrêt

---

### 3. Test de Routes Dynamiques - CRITIQUE pour Prydam

**Scénario**: Plugin qui enregistre des routes pour monitoring

```typescript
// test_plugin_routes.ts
import { createServer, Plugin } from "../src";

const monitoringPlugin = Plugin.create({
    name: "monitoring",
    version: "1.0.0",

    registerRoutes(app) {
        console.log("✓ registerRoutes called");

        // Route de health check
        app.get("/health", (req, res) => {
            res.json({
                status: "healthy",
                uptime: process.uptime(),
                memory: process.memoryUsage(),
            });
        });

        // Route de metrics
        app.get("/metrics", (req, res) => {
            res.json({
                requests: 1234,
                errors: 5,
                avgResponseTime: 45,
            });
        });

        // Route de status
        app.get("/status", (req, res) => {
            res.json({
                clones: [
                    { id: "clone-1", status: "active" },
                    { id: "clone-2", status: "standby" },
                ],
            });
        });
    },
});

Plugin.exec(monitoringPlugin);

const app = createServer({});

app.start(8080, async () => {
    console.log("Testing plugin routes...");

    const health = await fetch("http://localhost:8080/health");
    console.log("/health:", await health.json());

    const metrics = await fetch("http://localhost:8080/metrics");
    console.log("/metrics:", await metrics.json());

    const status = await fetch("http://localhost:8080/status");
    console.log("/status:", await status.json());

    process.exit(0);
});
```

**Validation:**

-   [ ] Routes enregistrées par le plugin sont accessibles
-   [ ] Routes ne conflictent pas avec les routes utilisateur
-   [ ] Réponses JSON correctes

---

### 4. Test de Middleware Global - CRITIQUE pour Prydam

**Scénario**: Plugin qui ajoute un middleware de monitoring

```typescript
// test_plugin_middleware.ts
import { createServer, Plugin } from "../src";

let requestCount = 0;
let errorCount = 0;

const metricsPlugin = Plugin.create({
    name: "metrics",
    version: "1.0.0",

    onRequest(req, res, next) {
        requestCount++;
        req.startTime = Date.now();
        console.log(
            `[METRICS] Request #${requestCount}: ${req.method} ${req.url}`
        );
        next();
    },

    onResponse(req, res) {
        const duration = Date.now() - req.startTime;
        console.log(`[METRICS] Response: ${req.url} (${duration}ms)`);
    },

    onError(error, req, res, next) {
        errorCount++;
        console.log(`[METRICS] Error #${errorCount}: ${error.message}`);
        next(error); // Passe au prochain error handler
    },
});

Plugin.exec(metricsPlugin);

const app = createServer({});

app.get("/fast", (req, res) => {
    res.json({ message: "Fast response" });
});

app.get("/slow", async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    res.json({ message: "Slow response" });
});

app.get("/error", (req, res) => {
    throw new Error("Test error");
});

app.start(8080, async () => {
    await fetch("http://localhost:8080/fast");
    await fetch("http://localhost:8080/slow");
    await fetch("http://localhost:8080/error");

    console.log(`Total requests: ${requestCount}`);
    console.log(`Total errors: ${errorCount}`);

    process.exit(0);
});
```

**Validation:**

-   [ ] Middleware s'exécute pour toutes les requêtes
-   [ ] Timing correct
-   [ ] Error counting fonctionne

---

### 5. Test de Dépendances - IMPORTANT pour Prydam

**Scénario**: Plugin avec dépendances entre plugins

```typescript
// test_plugin_dependencies.ts
import { createServer, Plugin } from "../src";

const configPlugin = Plugin.create({
    name: "config",
    version: "1.0.0",

    onServerStart() {
        console.log("✓ Config plugin started");
        // Expose config globally
        (global as any).prydamConfig = {
            strategy: "hot",
            clones: 2,
        };
    },
});

const daemonPlugin = Plugin.create({
    name: "daemon",
    version: "1.0.0",
    dependencies: ["config"], // Dépend de config

    onServerStart() {
        console.log("✓ Daemon plugin started");
        const config = (global as any).prydamConfig;
        console.log("Using config:", config);
    },
});

// Enregistrer dans le mauvais ordre (daemon avant config)
Plugin.exec(daemonPlugin);
Plugin.exec(configPlugin);

const app = createServer({});

app.start(8080, () => {
    console.log("Server started - dependencies should be resolved");
    process.exit(0);
});
```

**Validation:**

-   [ ] Dépendances résolues automatiquement
-   [ ] Ordre d'exécution correct malgré l'ordre d'enregistrement
-   [ ] Erreur si dépendance manquante

---

### 6. Test de Plugin Tardif - CRITIQUE pour Prydam

**Scénario**: Plugin enregistré APRÈS le démarrage du serveur

```typescript
// test_late_plugin.ts
import { createServer, Plugin } from "../src";

const app = createServer({});

app.get("/test", (req, res) => {
    res.json({ message: "OK" });
});

app.start(8080, async () => {
    console.log("Server started");

    // Attendre 1 seconde
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Enregistrer un plugin APRÈS le démarrage
    console.log("Registering late plugin...");

    const latePlugin = Plugin.create({
        name: "late-plugin",
        version: "1.0.0",

        onServerStart() {
            console.log("✓ Late plugin onServerStart called");
        },

        onServerReady() {
            console.log("✓ Late plugin onServerReady called");
        },

        registerRoutes(app) {
            console.log("✓ Late plugin registerRoutes called");
            app.get("/late", (req, res) => {
                res.json({ message: "Late plugin route" });
            });
        },
    });

    Plugin.exec(latePlugin);

    // Tester la route
    await new Promise((resolve) => setTimeout(resolve, 500));
    const response = await fetch("http://localhost:8080/late");
    console.log("Late route response:", await response.json());

    process.exit(0);
});
```

**Validation:**

-   [ ] Plugin tardif s'initialise correctement
-   [ ] Hooks `onServerStart` et `onServerReady` appelés
-   [ ] Routes enregistrées et accessibles
-   [ ] Pas de crash ou erreur

---

### 7. Test de Crash Recovery - ULTRA CRITIQUE pour Prydam

**Scénario**: Simuler un crash et vérifier la récupération

```typescript
// test_crash_recovery.ts
import { createServer, Plugin } from "../src";

let crashCount = 0;

const crashMonitorPlugin = Plugin.create({
    name: "crash-monitor",
    version: "1.0.0",

    onError(error, req, res, next) {
        crashCount++;
        console.log(
            `[CRASH MONITOR] Error detected #${crashCount}:`,
            error.message
        );

        // Log pour Prydam
        console.log("[CRASH MONITOR] Stack:", error.stack);
        console.log("[CRASH MONITOR] Memory:", process.memoryUsage());
        console.log("[CRASH MONITOR] Uptime:", process.uptime());

        // Décider si c'est fatal
        if (error.message.includes("FATAL")) {
            console.log("[CRASH MONITOR] FATAL ERROR - Triggering failover");
            // Prydam détectera ceci et basculera
            process.exit(1);
        }

        // Erreur non-fatale, continuer
        res.status(500).json({ error: "Handled" });
    },
});

Plugin.exec(crashMonitorPlugin);

const app = createServer({});

app.get("/non-fatal-error", (req, res) => {
    throw new Error("Non-fatal error");
});

app.get("/fatal-error", (req, res) => {
    throw new Error("FATAL: Critical system error");
});

app.start(8080, async () => {
    // Test erreur non-fatale
    await fetch("http://localhost:8080/non-fatal-error");
    console.log("Server still running after non-fatal error");

    // Test erreur fatale (causera un exit)
    setTimeout(async () => {
        console.log("Triggering fatal error...");
        await fetch("http://localhost:8080/fatal-error");
    }, 1000);
});
```

**Validation:**

-   [ ] Erreurs non-fatales gérées sans crash
-   [ ] Erreurs fatales détectées
-   [ ] Logs de crash capturés
-   [ ] Process exit avec code approprié

---

### 8. Test de Performance - IMPORTANT pour Prydam

**Scénario**: Mesurer l'overhead du système de plugins

```typescript
// test_plugin_performance.ts
import { createServer, Plugin } from "../src";

const performancePlugin = Plugin.create({
    name: "performance",
    version: "1.0.0",

    onRequest(req, res, next) {
        req.pluginStartTime = process.hrtime.bigint();
        next();
    },

    onResponse(req, res) {
        const duration =
            Number(process.hrtime.bigint() - req.pluginStartTime) / 1000000; // ms
        console.log(`Plugin overhead: ${duration.toFixed(3)}ms`);
    },
});

Plugin.exec(performancePlugin);

const app = createServer({});

app.get("/test", (req, res) => {
    res.json({ message: "OK" });
});

app.start(8080, async () => {
    console.log("Running performance test...");

    // 1000 requêtes
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
        await fetch("http://localhost:8080/test");
    }
    const duration = Date.now() - start;

    console.log(`1000 requests in ${duration}ms`);
    console.log(`Average: ${(duration / 1000).toFixed(2)}ms per request`);

    process.exit(0);
});
```

**Validation:**

-   [ ] Overhead < 1ms par requête
-   [ ] Pas de memory leak
-   [ ] Performance stable

---

## 🚀 Plan d'Exécution

### Phase 1: Tests Basiques (Aujourd'hui)

1. ✅ Test 1: Plugin Simple (FAIT)
2. [ ] Test 2: Lifecycle Hooks
3. [ ] Test 3: Routes Dynamiques

### Phase 2: Tests Avancés (Demain)

4. [ ] Test 4: Middleware Global
5. [ ] Test 5: Dépendances
6. [ ] Test 6: Plugin Tardif

### Phase 3: Tests Critiques (Après-demain)

7. [ ] Test 7: Crash Recovery
8. [ ] Test 8: Performance

---

## 📝 Checklist de Validation

**Pour que l'API Plugin soit prête pour Prydam:**

-   [ ] Tous les hooks lifecycle fonctionnent
-   [ ] Routes dynamiques enregistrées correctement
-   [ ] Middleware global fonctionne
-   [ ] Dépendances résolues automatiquement
-   [ ] Plugins tardifs supportés
-   [ ] Crash recovery détecté
-   [ ] Performance acceptable (< 1ms overhead)
-   [ ] Pas de memory leak
-   [ ] Error handling robuste
-   [ ] Documentation complète

---

## 🎯 Critères de Succès

**L'API Plugin est prête si:**

1. ✅ 100% des tests passent
2. ✅ Performance < 1ms overhead
3. ✅ Aucun crash durant les tests
4. ✅ Memory usage stable
5. ✅ Documentation à jour

---

**Date**: 2025-12-12  
**Status**: En cours - Phase 1  
**Prochaine étape**: Exécuter Test 2 (Lifecycle Hooks)

