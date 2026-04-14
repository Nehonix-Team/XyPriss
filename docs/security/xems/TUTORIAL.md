# XEMS Tutorial: Building High-Security Authentication

Ce tutoriel détaille l'implémentation de systèmes d'authentification avancés utilisant **XyPriss Encrypted Memory Store (XEMS)**. XEMS est conçu pour surpasser les sessions traditionnelles par son isolation native, sa rotation atomique et son chiffrement lié au matériel.

---

## 1. Concepts Fondamentaux

XEMS repose sur une architecture de **Défense à Cible Mouvante** (Moving Target Defense) :

- **Isolation par Sandbox** : Les données sont isolées dans des namespaces (sandboxes) étanches.
- **Rotation Atomique** : Chaque accès peut générer un nouveau token, invalidant l'ancien.
- **Liaison Matérielle** : Les données sont liées cryptographiquement à l'identité physique du serveur.

> [!IMPORTANT]
> XEMS utilise un sidecar en Go pour le stockage. Cela garantit qu'une faille dans l'application Node.js ne permet pas d'accéder directement à la mémoire brute des sessions.

---

## 2. API de Session (createSession / resolveSession)

Contrairement au simple stockage clé/valeur, la couche de session gère des tokens opaques et leur cycle de vie.

### Création d'une Session

Utilisez `createSession` pour générer un token sécurisé lié à un objet de données.

```typescript
const runner = xems.forApp(app);
const token = await runner.createSession(
    "auth-pending",
    {
        email: "user@example.com",
        mfa_verified: false,
    },
    { ttl: "15m" },
);
```

### Résolution et Rotation

`resolveSession` récupère les données et peut effectuer une rotation atomique pour prévenir les attaques par rejeu.

```typescript
const session = await runner.resolveSession(token, {
    sandbox: "auth-pending",
    rotate: true, // Génère un nouveau token atomiquement
    gracePeriod: 2000, // Laisse 2s à l'ancien token pour les requêtes concurrentes
});

if (session) {
    console.log("Data:", session.data);
    console.log("New Token:", session.newToken);
}
```

> [!WARNING]
> La rotation atomique est critique dans les Single Page Applications (SPA). Sans **Grace Period**, des requêtes concurrentes (ex: chargement de plusieurs widgets) provoqueraient des déconnexions si l'une d'elles invalide le token avant que les autres n'aient fini.

---

## 3. Workflow de Login Multi-étape (MFA)

Voici le schéma recommandé pour un portail sécurisé :

1. **Étape 1** : Validation email/password. Création d'une session temporaire dans `otp-pending`.
2. **Étape 2** : Validation de l'OTP. Migration des données vers une session active via `xLink()`.

```typescript
// PortalRouter.ts (Simulation)
router.post("/mfa/verify", async (req, res) => {
    const runner = xems.forApp(req.app);
    const tempSession = await runner
        .from("otp-pending")
        .get(req.body.tempToken);

    if (otpValid) {
        // Migration vers session active (High-level API)
        await res.xLink({ userId: tempSession.userId, role: "admin" });
        await runner.from("otp-pending").del(req.body.tempToken);
    }
});
```

---

## 4. Sécurité et Bonnes Pratiques

### Gestion des Secrets de Persistence

Si la persistence est activée, le secret doit être rigoureusement protégé.

> [!CAUTION]
> Le secret de persistence doit faire exactement **32 octets**. Un secret faible ou prévisible compromet l'intégralité du stockage chiffré sur disque. Utilisez des variables d'environnement.

### Isolation Multi-serveur

Dans une architecture multi-serveur, chaque instance XEMS est isolée.

> [!TIP]
> Utilisez toujours `xems.forApp(req.app)` dans vos handlers pour garantir que vous communiquez avec le processus XEMS lié à l'instance de serveur traitant la requête.

---

## 5. Intégration Frontend

Pour les sessions XEMS (`xLink`), le frontend ne doit jamais manipuler les tokens directement.

- Utilisez `withCredentials: true` avec Axios ou `fetch`.
- Laissez le navigateur et le framework XyPriss gérer la rotation via les cookies `HttpOnly`.

---

_Copyright © 2026 Nehonix Team. Professional Security Documentation._

