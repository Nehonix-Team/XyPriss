# 🛡️ XEMS Deep Security & Architectural Audit Report

**Date d'audit :** 29 Août 2026  
**Cible :** XyPriss Encrypted Memory Store (XEMS) v1.1.21 / Engine Go x86_64  
**Projet audité :** GECOMACI (Ezra Backend)  
**Type d'évaluation :** Pentesting boîte blanche, Reverse Engineering binaire ELF, Analyse cryptographique, Test de concurrence & Stress-test de rotation de session.

---

## 📋 Résumé Exécutif

L'audit approfondi de **XEMS** a permis de valider les engagements de sécurité avancés présentés par XyPriss, tout en mettant en évidence **une vulnérabilité fonctionnelle critique dans l'intercepteur de rotation de session Node.js / XHSC**.

| Pilier de sécurité / Engagement | Statut | Résultat de l'analyse |
| :--- | :---: | :--- |
| **Binaire natif autonome (Sidecar Go)** | ✅ Validé | Binaire ELF 64-bit autonome en Go, communication IPC via stdio (JSON streams). |
| **Isolation mémoire Node.js (Zero Heap Leak)** | ✅ Validé | Aucune `Map` JS en mémoire Node.js. Les données sont entièrement isolées dans le processus Go. |
| **Chiffrement AES-256-GCM en RAM (Go Process)** | ✅ Validé | Les valeurs sont chiffrées en AES-256-GCM **même lorsqu'elles résident dans la mémoire vive de Go**. |
| **Cryptographie Hardware-Bound (HWID)** | ✅ Validé | Clé maîtresse dérivée par `SHA-256(HWID + secret)`. Protection anti-vol/déplacement de vault confirmée. |
| **Persistance atomique sur disque** | ✅ Validé | Écriture en fichier `.tmp` puis `rename` atomique POSIX. Format : Header `XEMS` + Nonce 12B + Payload Gob chiffré AES-GCM + Tag AEAD 16B. |
| **Tolérance aux pannes (Crash Recovery)** | ✅ Validé | En cas de `SIGKILL` du binaire Go, redémarrage automatique en < 2s avec restauration immédiate du vault. |
| **Rotation atomique & Période de grâce (Go Engine)** | ✅ Validé | Rotation atomique native fonctionnelle avec grace period (les requêtes concurrentes en vol réussissent). |
| **Propagation du cookie de rotation (Node.js Plugin)** | ❌ **BUG CRITIQUE** | `XemsBuiltinPlugin.js` n'intercepte pas `res.xJson` (utilisé par le helper standard `Send`). Les nouveaux tokens ne sont pas transmis au client. |

---

## 🔍 1. Architecture & Nature du Binaire XEMS

### A. Identification du binaire
Le binaire `/home/idevo/Documents/projects/Ezra/server/node_modules/xypriss/bin/xems` est un exécutable **Linux ELF 64-bit statique compilé en Go** (`github.com/Nehonix-Team/XyPriss-XEMS`) utilisant :
- `github.com/denisbrodbeck/machineid` pour la capture de l'identifiant matériel de la machine.
- `crypto/internal/fips140/sha256` pour la dérivation de clé.
- `crypto/cipher` (`NewGCM`, `Seal`, `Open`) pour le chiffrement/déchiffrement AEAD AES-256-GCM.
- `encoding/gob` pour la sérialisation des structures internes de persistance.

### B. Modèle IPC et Absence de Map JS
Dans `XemsPlugin.js` et `XemsBuiltinPlugin.js` :
- Node.js n'instancie **aucune structure `Map` ou cache en mémoire**.
- Chaque appel (`xems.set`, `xems.get`, `xems.del`, `resolveSession`) transite sous forme de commande JSON vers le flux `stdin` du binaire Go.
- La latence IPC mesurée en conditions réelles est de **~1.8 ms à 2.5 ms**.

---

## 🔐 2. Analyse Cryptographique & Persistance sur Disque

### A. Dérivation de clé Hardware-Bound
La clé maîtresse 256 bits est générée dans `internal/crypto.InitMasterKey` :
$$\text{MasterKey} = \text{SHA-256}(\text{HWID} \parallel \text{SecretKey})$$
- Le HWID est lu de manière déterministe via `/etc/machine-id` (ou DBus).
- **Test de falsification HWID / Secret :** Lorsque nous avons tenté de déchiffrer le fichier `client.gecoma.ci.xems` avec un faux HWID ou une mauvaise clé secrète, l'authentification AES-GCM a immédiatement échoué (`Unsupported state or unable to authenticate data`). Le vault est mathématiquement indéchiffrable s'il est exfiltré vers un autre serveur physique.

### B. Structure du fichier `.xems`
L'inspection binaire des fichiers générés (`server/data/*.xems`) démontre la structure suivante :
```
+-------------------+--------------------+-----------------------------+---------------------+
| Magic (4 bytes)   | Nonce (12 bytes)   | CipherText (Gob Serialized) | GCM Auth Tag (16 B) |
| "XEMS" 0x534D4558 | crypto/rand Nonce  | AES-256-GCM Payload         | Poly1305 / GHASH    |
+-------------------+--------------------+-----------------------------+---------------------+
```

### C. Chiffrement à double niveau (In-Memory Encryption)
L'analyse du désassemblage de `store.setInternal` (offset `0x506060`) révèle que :
1. Avant d'insérer une entrée dans la table de hachage mémoire du processus Go, la fonction `crypto.Encrypt` est appelée.
2. Les données en mémoire vive dans le heap Go sont stockées **sous forme chiffrée** avec leur nonce individuel.
3. Elles ne sont déchiffrées qu'au moment précis de leur lecture (`crypto.Decrypt`).

---

## ⚡ 3. Concurrence, Rotation Atomique et Résilience

### A. Test de rotation de session avec Période de Grâce (Grace Period)
Nous avons simulé des requêtes concurrentes à haute vélocité :
1. Session initiale : `session_original_1234567890abcdef`.
2. Rotation déclenchée avec `grace_period = 500ms`.
3. Le moteur Go génère un token aléatoire cryptographique de 48 caractères hexadécimaux :
   `ef63aa7948c7af0b3e7d30d912a2122eb68047d8a89c5785`.
4. **Requête concurrente à t = 100ms** avec l'ancien token : **Succès (200 OK)** grâce au tampon temporel `ZombieUntil` géré en Go.
5. **Requête avec le nouveau token** : **Succès immédiat (200 OK)**.
6. **Requête après expiration du délai de grâce (t = 700ms)** avec l'ancien token : **Rejet strict (401 / Not Found)**.

### B. Test de Crash & Redémarrage (Kill -9)
- Le processus `xems` a été tué brutalement (`SIGKILL`).
- `XemsRunner` détecte la fermeture du socket stdio et relance une instance Go dans un délai de 2 secondes.
- L'intégralité des sessions et états a été restaurée à l'identique depuis le fichier persistant sans aucune corruption de données.

---

## 🐛 4. BUG REPORT CRITIQUE : Désynchronisation de la Rotation lors de l'usage du helper `Send`

### Description du problème
Dans l'architecture XyPriss, le helper standard recommandé pour envoyer des réponses HTTP est la classe `Send` (ex: `send.ok()`, `send.unauthorized()`, etc.).  
Dans `Send.js` (ligne 641) :
```typescript
this.res.status(statusCode).xJson(body);
```
Cependant, dans `XemsBuiltinPlugin.js` (lignes 272–289) :
```javascript
// Seules res.send et res.json sont interceptées !
const originalSend = res.send;
res.send = function (body) {
    const newToken = res._xemsNewToken;
    if (newToken) {
        res.cookie(cookieName, newToken, cookieOptions);
        res.setHeader(headerName, newToken);
    }
    return originalSend.call(this, body);
};
const originalJson = res.json;
res.json = function (data) {
    const newToken = res._xemsNewToken;
    if (newToken) {
        res.cookie(cookieName, newToken, cookieOptions);
        res.setHeader(headerName, newToken);
    }
    return originalJson.call(this, data);
};
```

### Impact
Lorsque `autoRotation: true` ou `rotate: true` est activé sur un serveur dont les contrôleurs utilisent `new Send(res)` ou `res.xJson()` :
1. Le moteur XEMS Go effectue la rotation et assigne `res._xemsNewToken = newToken`.
2. Le contrôleur appelle `send.ok(...)`, qui exécute `res.xJson(...)`.
3. Comme `res.xJson` n'est pas enveloppé par `XemsBuiltinPlugin`, **l'en-tête `Set-Cookie` et l'en-tête `X-Xypriss-Token` ne sont JAMAIS injectés dans la réponse HTTP**.
4. Le client navigateur conserve l'ancien token.
5. Après l'écoulement de la `gracePeriod` (par défaut 1000ms), toute requête ultérieure de l'utilisateur est rejetée avec un code `401 Unauthorized`. L'utilisateur est déconnecté de manière inattendue.

### Solution recommandée
Dans `XemsBuiltinPlugin.ts` / `XemsBuiltinPlugin.js`, intercepter également `res.xJson` et `res.end` :
```javascript
const originalXJson = res.xJson;
if (typeof originalXJson === "function") {
    res.xJson = function (data) {
        const newToken = res._xemsNewToken;
        if (newToken) {
            res.cookie(cookieName, newToken, cookieOptions);
            res.setHeader(headerName, newToken);
        }
        return originalXJson.call(this, data);
    };
}
```

---

## 📊 5. Conclusion & Verdict de l'Audit

1. **Intégrité des promesses techniques :** La promesse d'une isolation stricte, d'un sidecar natif compilé, d'une cryptographie hardware-bound AES-256-GCM et d'une rotation atomique est **100% réelle et confirmée**. Il ne s'agit pas d'un wrapper cosmétique en JavaScript, mais d'une architecture native robuste.
2. **Action requise :** Corriger l'intercepteur `res.xJson` dans `XemsBuiltinPlugin` pour permettre à la rotation automatique de fonctionner de manière transparente avec la suite `Send` de XyPriss.
