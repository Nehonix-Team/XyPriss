# XyPriss Plugin Signature System — Spécification Technique

> État : Finalisé — Architecture Hybrid Decentralized (2.B) + Portable (3)

---

## 1. Objectif & Philosophie

L'objectif n'est pas la sécurité absolue (qui n'existe pas) mais d'augmenter drastiquement le coût d'une attaque au point où elle ne vaut plus la peine d'être tentée.

Le système repose sur trois piliers :

- Pas de serveur Nehonix dédié — tout transite via npm/xfpm comme une lib normale.
- Décentralisé par design — aucune autorité centrale n'est requise pour signer ou vérifier.
- Défense en profondeur — plusieurs couches indépendantes. Un attaquant doit toutes les casser simultanément.

---

## 2. Vue d'ensemble des acteurs

| Acteur                | Rôle                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------- |
| **Peter** (publisher) | Développeur du plugin. Signe son code avec sa clé privée locale.                      |
| **Admin** (consumer)  | Intègre le plugin dans son serveur XyPriss. Vérifie et accorde sa confiance.          |
| **xfpm**              | Package manager Rust. Orchestre la vérification à l'installation.                     |
| **XHSC**              | Moteur Go natif de XyPriss. Re-vérifie l'intégrité à chaque démarrage.                |
| **XEMS**              | Store chiffré AES-256-GCM. Héberge le trust store local de l'admin.                   |
| **npm**               | Vecteur de distribution. Garant passif de l'intégrité via son propre hash de tarball. |

---

## 3. Structure des fichiers

### Côté publisher (dans le package npm)

```
xypriss-swagger/
├── dist/
│   └── index.js
├── package.json
├── README.md                  ← author_key fingerprint publié ici (OBLIGATOIRE)
├── xypriss.config.jsonc       ← déclare type: "plugin"
└── xypriss.plugin.sig         ← manifest signé (JSON lisible)
```

### Côté consumer (dans son projet)

```
my-server/
├── src/
│   └── index.ts
├── xypriss.config.jsonc       ← contient le bloc "signature" par plugin
└── node_modules/
    └── xypriss-swagger/
```

---

## 4. Format des fichiers

### 4.1 `xypriss.plugin.sig` (publié avec le package)

Fichier JSON **lisible et auditable** — l'admin peut l'inspecter à l'œil nu.

```jsonc
{
    "name": "xypriss-swagger",
    "version": "1.0.22",
    "min_version": "1.0.20",
    "content_hash": "sha256:a1b2c3d4e5f6...",
    "prev_version_hash": "sha256:f9e8d7c6b5a4...",
    "issued_at": "2025-01-10T08:00:00Z",
    "expires_at": "2026-01-10T08:00:00Z",
    "author_key": "ed25519:b2bd9a...cfd",
    "signature": "base64:XYZ...",
}
```

| Champ                      | Rôle                                                 | Protection contre                       |
| -------------------------- | ---------------------------------------------------- | --------------------------------------- |
| `content_hash`             | Hash SHA-256 récursif de tous les fichiers du plugin | Modification du code                    |
| `prev_version_hash`        | Hash du `plugin.sig` de la version précédente        | Replay attack (downgrade)               |
| `min_version`              | Version minimale acceptée                            | Downgrade forcé vers version vulnérable |
| `issued_at` / `expires_at` | Fenêtre de validité temporelle                       | Replay attack (version expirée)         |
| `author_key`               | Clé publique Ed25519 de Peter                        | Usurpation d'identité                   |
| `signature`                | Signature Ed25519 de tout le bloc ci-dessus          | Falsification du manifest               |

### 4.2 `xypriss.config.jsonc` — bloc `signature` (côté consumer)

Ce bloc est **écrit automatiquement** par xfpm lors du premier install (TOFU), puis **vérifié en lecture seule** par XHSC à chaque démarrage.

```jsonc
{
    "$internal": {
        "xypriss-swagger": {
            // Permissions (système existant — inchangé)
            "permissions": {
                "allowedHooks": ["PLG.HTTP.ON_REQUEST", "PLG.HTTP.ON_RESPONSE"],
                "policy": "allow",
            },

            // Sandbox filesystem (système existant — inchangé)
            "__xfs__": {
                "path": "ROOT://.private/plugin-data/swagger",
            },

            // Bloc signature (NOUVEAU)
            "signature": {
                "author_key": "ed25519:b2bd9a...cfd", // copié du README du plugin
                "trusted_since": "2025-01-10T08:00:00Z",
                "last_verified": "2025-01-15T10:00:00Z",
                "pinned_version": "1.0.22", // optionnel : freeze sur une version précise
                "min_version": "1.0.20", // refuse les downgrades
            },
        },
    },
}
```

---

## 5. Algorithme complet

### Phase A — Publication (Peter)

```
1. Peter développe xypriss-swagger v1.0.22

2. xfpm sign ./mods/swagger
   ├── Scan récursif de tous les fichiers pertinents du plugin
   ├── Calcul du content_hash (SHA-256 récursif)
   ├── Récupération du prev_version_hash (depuis le plugin.sig de v1.0.21)
   └── Construction du manifest :
       {
         name, version, min_version,
         content_hash, prev_version_hash,
         issued_at, expires_at,
         author_key  ← clé publique de Peter
       }

3. Signature Ed25519 du manifest avec la clé privée de Peter
   → Génère "signature": "base64:XYZ..."

4. Écriture de xypriss.plugin.sig dans le package

5. Peter publie son README avec son author_key fingerprint (OBLIGATOIRE)
   Exemple dans README.md :
   > Author Key: ed25519:b2bd9a...cfd

6. xfpm publish → npm registry
   └── npm calcule son propre sha512 du tarball (garant passif supplémentaire)
```

### Phase B — Installation (Admin, première fois)

```
1. xfpm install xypriss-swagger
   ├── Télécharge le package depuis npm
   ├── Vérifie le sha512 du tarball (intégrité npm)
   └── Détecte xypriss.plugin.sig

2. XHSC / xfpm détecte : pas de bloc "signature" dans xypriss.config.jsonc
   → Mode TOFU activé

3. Affichage interactif :
   ┌─────────────────────────────────────────────────────────────┐
   │ [SECURITY] Nouveau plugin détecté : xypriss-swagger         │
   │ [SECURITY] Auteur déclaré : Peter                           │
   │ [SECURITY] Author Key : ed25519:b2bd9a...cfd                │
   │                                                             │
   │ Note : Vérifiez ce fingerprint dans le README du plugin :   │
   │   https://npmjs.com/package/xypriss-swagger                 │
   │                                                             │
   │ Faites-vous confiance à cet auteur ? (y/N) :               │
   └─────────────────────────────────────────────────────────────┘

   → Si l'admin tape N : installation annulée.
   → Si l'admin tape Y sans avoir rempli author_key manuellement :
     xfpm écrit le bloc "signature" dans xypriss.config.jsonc
     avec l'author_key extrait du plugin.sig.

   IMPORTANT : Le flow est intentionnellement inconfortable.
   L'admin doit avoir une action consciente, pas juste appuyer sur Entrée.

4. Vérification cryptographique initiale :
   ├── Re-calcul du content_hash des fichiers installés dans node_modules
   ├── Vérification de la signature Ed25519 avec author_key
   ├── Comparaison content_hash local == content_hash dans plugin.sig
   ├── Vérification expires_at (pas expiré)
   └── Vérification min_version (version installée >= min_version)

5. Si tout est OK → plugin chargé. Bloc "signature" écrit dans xypriss.config.jsonc.
```

### Phase C — Vérification à chaque démarrage (XHSC)

```
1. XHSC lit xypriss.config.jsonc
   └── Récupère signature.author_key pour chaque plugin enregistré

2. Pour chaque plugin :
   ├── Lit xypriss.plugin.sig dans node_modules/[plugin]/
   ├── Vérifie que plugin.sig.author_key == config.signature.author_key
   │   (si différent → FATAL : auteur non autorisé)
   ├── Re-calcule le content_hash des fichiers installés
   ├── Vérifie la signature Ed25519 (author_key + manifest)
   ├── Compare content_hash local == plugin.sig.content_hash
   ├── Vérifie expires_at
   └── Vérifie min_version vs config.signature.min_version

3. Tout OK → serveur démarre normalement.
```

---

## 6. Scénarios d'attaque et réponses

### Scénario 1 — Modification du code post-installation

Un attaquant accède au serveur et modifie `node_modules/xypriss-swagger/dist/index.js`.

```
Au prochain démarrage :
XHSC re-calcule le content_hash → différent de plugin.sig.content_hash

[FATAL] Erreur d'intégrité : 'xypriss-swagger'
[FATAL] Le contenu a été modifié depuis la signature de Peter.
[SYSTEM] Démarrage du serveur annulé.
```

### Scénario 2 — Usurpation d'identité (faux plugin)

Un attaquant publie un plugin malveillant nommé `xypriss-swagger`, signé avec sa propre clé.

```
À l'installation :
xfpm lit plugin.sig.author_key → ed25519:fa72da...111
config.signature.author_key    → ed25519:b2bd9a...cfd  (celle de Peter, déjà trustée)

[FATAL] Auteur non autorisé pour 'xypriss-swagger'
[FATAL] Auteur attendu  : ed25519:b2bd9a...cfd
[FATAL] Auteur fourni   : ed25519:fa72da...111
```

### Scénario 3 — Replay attack (downgrade vers version vulnérable)

Un attaquant tente de forcer l'installation de `xypriss-swagger@1.0.18` (vulnérable).

```
xfpm vérifie :
plugin.sig.min_version = "1.0.20"
version installée      = "1.0.18"  → 1.0.18 < 1.0.20

[FATAL] Version refusée : 'xypriss-swagger@1.0.18'
[FATAL] Version minimale requise : 1.0.20
```

De plus, le chainage `prev_version_hash` casse la continuité si la chaîne de versions est altérée.

### Scénario 4 — Signature expirée

Peter a oublié de re-signer son plugin depuis plus d'un an.

```
XHSC vérifie :
plugin.sig.expires_at = "2025-01-10T08:00:00Z"
Date actuelle         = "2026-02-01T00:00:00Z"  → expiré

[WARNING] Plugin 'xypriss-swagger' : signature expirée.
[WARNING] Le plugin sera chargé mais l'auteur doit publier une mise à jour signée.
[WARNING] Passage en mode dégradé (non-bloquant par défaut, bloquant si strict: true).
```

_Note : expiré = warning ou fatal selon la config `strict` du server._

### Scénario 5 — Trust store corrompu

Un attaquant modifie `xypriss.config.jsonc` pour remplacer `author_key` par sa propre clé.

```
XHSC charge config.signature.author_key → clé de l'attaquant
Plugin.sig.author_key                   → clé de Peter

Résultat identique au Scénario 2 : clé du plugin.sig ≠ clé dans config.
```

**Mitigation supplémentaire** : le trust store (`signature` block) étant dans `xypriss.config.jsonc`, il bénéficie du contrôle de version du projet (git). Toute modification est traçable.  
**Mitigation avancée** : XEMS peut stocker un hash signé du bloc `signature` pour détecter une modification hors git.

---

## 7. Révocation

Sans serveur centralisé, la révocation passe par le package npm lui-même.

Peter publie une nouvelle version avec un bloc de révocation dans `xypriss.plugin.sig` :

```jsonc
{
    "name": "xypriss-swagger",
    "version": "1.0.23",
    // ... champs normaux ...
    "revocation": {
        "revoked_keys": ["ed25519:ancienne_cle_compromise..."],
        "revoked_versions": ["1.0.18", "1.0.19", "1.0.20"],
        "reason": "private key compromised",
        "signed_by": "ed25519:nouvelle_cle...",
        "issued_at": "2025-06-01T00:00:00Z",
    },
}
```

xfpm vérifie ce bloc lors d'un `xfpm update` ou `xfpm audit`. XHSC peut le re-vérifier périodiquement en background (ex: toutes les 24h si connexion disponible).

---

## 8. Obligations du publisher (Peter)

Ces règles doivent figurer dans la documentation officielle d'authoring XyPriss :

1. Publier son `author_key` fingerprint dans le README du plugin. C'est la seule ancre de confiance indépendante du package lui-même.
2. Re-signer avant `expires_at` — la signature a une durée de vie maximale d'un an.
3. Chaîner les versions — chaque `plugin.sig` doit référencer le hash du `plugin.sig` précédent.
4. Activer le 2FA npm — npm l'impose déjà pour les packages publiés ; c'est la protection du compte.
5. En cas de compromission : publier immédiatement une version de révocation avec une nouvelle clé.

---

## 9. Résumé des garanties

| Menace                                        | Statut  | Mécanisme                                           |
| --------------------------------------------- | ------- | --------------------------------------------------- |
| Modification du code post-install             | Protégé | content_hash re-calculé à chaque démarrage          |
| Faux plugin (même nom, autre auteur)          | Protégé | author_key dans trust store ≠ author_key du package |
| Downgrade vers version vulnérable             | Protégé | min_version + prev_version_hash                     |
| Replay de signature expirée                   | Protégé | expires_at vérifié par XHSC                         |
| Corruption du trust store                     | Partiel | Git + XEMS hash optionnel                           |
| Compte npm du dev compromis (nouveau install) | Risque  | TOFU + cross-check README obligatoire               |
| Compromise au premier install (TOFU)          | Risque  | Flow interactif + fingerprint README                |
| Nehonix lui-même compromis                    | Protégé | Pas de serveur Nehonix dans la chaîne               |

---

## 10. Ce que ce système ne garantit pas

Par honnêteté intellectuelle :

- **Le TOFU reste TOFU** : si l'admin ne vérifie pas le fingerprint dans le README, il reste vulnérable au premier install.
- **La révocation n'est pas temps-réel** : elle dépend d'un `xfpm update` ou `xfpm audit` explicite.
- **L'humain** : un admin qui met `strict: false` ou qui ignore les warnings annule une partie des protections. On peut rendre ça inconfortable mais pas l'empêcher.

---

## 11. Points ouverts (à décider)

- [ ] Comportement exact quand `expires_at` est dépassé : warning seul, ou fatal si `strict: true` ?
- [ ] `pinned_version` : doit-il bloquer les mises à jour automatiques ?
- [ ] Fréquence du check de révocation background dans XHSC (si connexion disponible).
- [ ] Est-ce que xfpm écrit `author_key` automatiquement au TOFU, ou force-t-il l'admin à le copier manuellement depuis le README ?
- [ ] Format exact du `content_hash` : inclure uniquement `dist/` ou tous les fichiers non-ignorés ?

