# XyPriss Nginx Controller (Project Brainstorm) = XyNginC

## Brainstorming & Architecture Design

> **Vision**: Un plugin officiel XyPriss qui simplifie radicalement la gestion de Nginx et SSL sur les VPS de production. Plus besoin de toucher manuellement aux fichiers de configuration `/etc/nginx/` ou de se battre avec Certbot.

---

## 📛 Nom du Projet - DÉCISIONS

**Options considérées:**

1. **XyNginC** (XyPriss Nginx Controller) ✅ CHOIX RECOMMANDÉ
    - **Prononciation**: "Zin-Jinx"
    - **Avantages**: Court, technique, unique.
2. **XyPriss Gateway**
    - **Évocation**: Point d'entrée, passerelle, contrôle.
3. **XyPriss Nginx Pilot**
    - **Évocation**: Pilote automatique pour Nginx.

**RECOMMANDATION FINALE: XyNginC**

-   Package npm: `@xypriss/xynginc`
-   CLI Binary: `xynginc-linux-x64` (Rust/Go)

---

## 🎯 Problème Identifié

**Situation actuelle:**

-   Les utilisateurs déploient XyPriss sur un VPS (Ubuntu/Debian).
-   Ils doivent configurer manuellement Nginx pour faire un reverse proxy vers le port de leur app (ex: 3000).
-   La syntaxe Nginx est complexe et source d'erreurs (502 Bad Gateway).
-   La génération SSL avec Certbot est une étape supplémentaire souvent mal comprise.
-   **Résultat**: Frustration, erreurs de configuration, sites non sécurisés.

**Impact:**

-   Barrière à l'entrée pour la mise en production.
-   Perte de temps sur de l'infra au lieu du code.

---

## 💡 Solution Proposée: XyNginC Plugin

### Concept Core

Une architecture hybride puissante :

1.  **Plugin TypeScript (`plugin.ts`)**: S'intègre dans l'application XyPriss, expose une API simple et télécharge/exécute le binaire.
2.  **Binaire Natif (Rust/Go)**: Un exécutable Linux autonome qui gère les opérations système (nginx, certbot, fichiers) avec performance et sécurité.

**Fonctionnalités Clés:**

1.  **Reverse Proxy Automatique**: "Mappe mon domaine `api.monsite.com` vers le port `3728`".
2.  **SSL en 1 commande**: "Active HTTPS pour `api.monsite.com`".
3.  **Gestion des Domaines**: Lister, Ajouter, Supprimer des configurations.
4.  **Zero Config Files**: Le binaire génère les fichiers `.conf` Nginx valides et optimisés.

---

## 🏗️ Architecture Technique

### 1. Stack Technologique

-   **Interface**: **TypeScript** (Node.js).
    -   S'intègre nativement via `Plugin.exec()`.
    -   Gère la configuration utilisateur et l'appel au binaire.
-   **Core Engine**: **Rust** (Recommandé) ou **Go**.
    -   **Rust**: Performance maximale, sécurité mémoire, binaire unique sans dépendances. Idéal pour un outil système critique ("Prydam vision").
    -   **Go**: Alternative solide, compilation rapide.
    -   **Rôle**: Exécuter les commandes `nginx`, `certbot`, écrire dans `/etc/nginx/`.
-   **OS Cible**: **Linux** (Ubuntu/Debian principalement).

### 2. Flux de Fonctionnement

```
┌──────────────────┐      ┌──────────────┐      ┌─────────────────┐
│  XyPriss App     │ ───> │  XyNginC     │ ───> │  XyNginC        │
│  (server.ts)     │      │  TS Plugin   │      │  Binary (Rust)  │
└──────────────────┘      └──────────────┘      └─────────────────┐
                                                       │
                                                       │ (Sudo/Root)
                                                       ▼
                                              ┌─────────────────┐
                                              │  System (Nginx) │
                                              └─────────────────┐
```

### 3. Usage Développeur

Le développeur n'a pas besoin de savoir qu'il y a du Rust/Go en dessous.

```typescript
// server.ts
import { createServer, Plugin } from "xypriss";
import XNCP from "xynginc"; // Le wrapper TS

const app = createServer({
    // ... config
});

// Enregistrement du plugin
Plugin.exec(
    XNCP({
        domains: [
            {
                domain: "api.nehonix.com",
                port: 3728,
                ssl: true,
                email: "admin@nehonix.com",
            },
        ],
        autoReload: true, // Reload nginx automatically
    })
);

app.start();
```

---

## 📋 API & Fonctionnalités (Draft)

### Interface TypeScript (Wrapper)

Le wrapper TS va :

1.  Vérifier la présence du binaire `xynginc`.
2.  Le télécharger si nécessaire (depuis GitHub Releases par exemple).
3.  Lancer le binaire avec les arguments appropriés lors du `onServerStart`.

```typescript
// plugin.ts (pseudo-code)
export default function XNCP(config: XyNginCConfig) {
    return Plugin.create({
        name: "xynginc",
        version: "1.0.0",

        onServerStart: async () => {
            // 1. Check binary
            await ensureBinaryExists();

            // 2. Execute binary with config
            // Le binaire reçoit la config en JSON via stdin ou fichier temp
            await execBinary("apply", JSON.stringify(config));
        },
    });
}
```

### Binaire (Rust/Go)

Commandes supportées par le binaire :

-   `xynginc apply --config <json>`: Applique toute la configuration.
-   `xynginc check`: Vérifie les pré-requis (nginx, certbot).
-   `xynginc status`: Retourne l'état des sites.

---

## 🚀 Roadmap

### Phase 1: MVP (Proof of Concept)

-   [ ] **Wrapper TS**: Structure du plugin XyPriss.
-   [ ] **Binaire (Rust/Go)**:
    -   Hello World qui lit une config JSON.
    -   Génération de fichier Nginx simple.
    -   Commande `nginx -t` et reload.
-   [ ] **Intégration**: Le plugin TS lance le binaire.

### Phase 2: SSL & Automation

-   [ ] Intégration `certbot` dans le binaire.
-   [ ] Gestion des erreurs robuste.
-   [ ] Distribution du binaire (GitHub Releases / NPM postinstall).

---

## 📝 Questions Ouvertes

1.  **Distribution**: Est-ce qu'on ship le binaire dans le package NPM (lourd) ou on le télécharge au `postinstall` (mieux) ? -> **Download au postinstall**.
2.  **Permissions**: Le binaire doit tourner en root. Si l'app Node n'est pas root, le plugin devra peut-être demander `sudo` ou échouer.

---

**Date**: 2025-12-14
**Auteur**: iDevo & Antigravity

