# Rapport d'incidents xfpm - NehoSell Project

Ce rapport détaille les problèmes rencontrés lors de l'utilisation de `xfpm` pour la gestion des dépendances dans le sous-projet `packages/NehoSell-Automate/engine`.

## 1. Contexte du système

- **OS** : Linux (Debian/Ubuntu)
- **Node.js** : v22.19.0
- **Projet** : Monorepo NehoSell utilisant `xfpm` et `XyPriss`.

## 2. Erreur : `ETXTBSY` (Text file busy)

### Description

Lors d'une tentative de mise à jour des packages (notamment `prisma` et `@prisma/client`), `xfpm` échoue car il tente de manipuler des fichiers ou binaires en cours d'utilisation par un processus actif.

### Trace d'erreur

```text
Error: ETXTBSY: text file is busy, open '/home/idevo/Documents/projects/NehoSell/packages/NehoSell-Automate/engine/node_modules/.xpm/virtual_store/xypriss@8.1.4/node_modules/xypriss/bin/xsys'
...
✖ xypriss@8.1.4 → postinstall script failed: Script exited with code Some(1)
```

### Cause probable

Le serveur `xsys` (utilisé par XyPriss) était en cours d'exécution. `xfpm` ne semble pas arrêter automatiquement les processus liés aux binaires qu'il tente de mettre à jour ou de réinstaller dans le `virtual_store`.

### Solution temporaire

Il a fallu tuer manuellement le processus `xsys` (`kill <PID>`) pour débloquer l'installation.

---

## 3. Erreur : `EXDEV` lors de l'installation de `bun` via `xfpm`

### Description

Une erreur système survient lors du renommage/déplacement de fichiers entre le répertoire `/tmp` et le répertoire `node_modules`.

### Trace d'erreur

```text
errno: -18,
code: 'EXDEV',
syscall: 'rename',
path: '/tmp/bun-OZun16/node_modules/@oven/bun-linux-x64',
dest: 'node_modules/@oven/bun-linux-x64'
```

### Cause probable

L'installateur tente d'utiliser une opération `rename` atomique entre deux systèmes de fichiers différents (souvent `/tmp` est sur un `tmpfs/ramdisk` alors que le projet est sur le disque principal). Les appels système `rename()` standard échouent dans ce cas.

---

## 4. Problème de résolution de version (Downgrade)

### Description

Une demande explicite pour forcer une version (ex: `xfpm i prisma@7.1.0`) semble parfois être ignorée ou écrasée par une version plus récente (7.4.0) déjà présente dans le cache ou le `virtual_store`, même après modification du `package.json`.

---

## Recommandations pour l'équipe xfpm

1. **Gestion de Verrouillage** : Implémenter une détection des binaires occupés (comme `xsys`) et proposer de les arrêter ou avertir l'utilisateur plus clairement.
2. **Fallback EXDEV** : Pour les installations de binaires (comme Bun), utiliser une copie suivie d'une suppression (`copy + unlink`) au lieu d'un `rename` si l'erreur `EXDEV` est détectée.
3. **Strict Versioning** : Améliorer la priorité des versions spécifiées manuellement par rapport au `virtual_store` lors des tentatives de downgrade.
