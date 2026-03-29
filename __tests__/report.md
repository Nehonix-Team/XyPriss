# Rapport Technique : Instabilité du Session Store (XEMS) en Environnement Concurrent

## 1. Description du Problème

Lors du chargement du Dashboard (React), plusieurs requêtes sont envoyées simultanément au backend (KPIs, Profil, Ventes, etc.). Bien que ces requêtes partagent le même jeton initial (`xems_token`), on observe une invalidation systématique de la session après environ deux requêtes réussies, entraînant une erreur **401 Unauthorized** sur les requêtes suivantes.

## 2. Analyse des Preuves (Logs & Screenshots)

L'observation des logs serveur et du réseau révèle un comportement critique de la part de **XEMS (XyPriss Encrypted Memory Store)** :

- **Requête 1 & 2** : Elles utilisent le jeton `a3a9...ef2` et réussissent (Status 200). XEMS valide le jeton et, à cause de `autoRotation: true`, génère un nouveau jeton pour la suite.
- **Requête 3** : Utilise TOUJOURS le jeton `a3a9...ef2` (car envoyée avant que le navigateur n'ait reçu le nouveau cookie de la Req 1). **Échec (Status 401)**. Le serveur loggue `req.session: undefined`.
- **Requêtes suivantes** : Réussissent à nouveau car elles commencent à utiliser les nouveaux jetons (`3ca6...`, `1838...`) envoyés par les réponses précédentes qui ont fini par arriver.

### Observation sur la Rotation Atomique

Le problème semble provenir de la manière dont la **file d'attente de grâce (Grace Queue)** est gérée dans le moteur Go sidecar de XyPriss :

1.  **Rotation 1** : `Token A` devient "Vieux", `Token B` devient "Tête". `Grace = {A}`.
2.  **Rotation 2** (déclenchée par une 2ème hit concurrente sur A) : `Token B` devient "Vieux", `Token C` devient "Tête". **`Grace = {B}`**. L'ancien `Token A` est expulsé de la mémoire de grâce pour faire place au nouveau cycle.
3.  **Résultat** : Toute 3ème requête arrivant encore avec le `Token A` est rejetée car elle a été poussée hors du tampon de sécurité.

## 3. Anomalie Détectée (IP Corrupt)

Les logs affichent `ip: "["` pour la session stockée. Cela indique une possible erreur de parsing dans XHSC lors de la capture de l'adresse IP (probablement une mauvaise gestion des adresses IPv6 type `[::1]` en local), ce qui pourrait aussi fragiliser la validation de session si XEMS tente de comparer ces chaînes.

## 4. Recommandations

### A. Solution Immédiate (Workaround)

Pour stabiliser le Dashboard en développement et éviter les 401 intempestifs lors des rafales de requêtes, il est conseillé de désactiver la rotation automatique ou d'augmenter drastiquement le délai de grâce (bien que le problème soit plus lié au nombre de hits qu'au temps).

**Modification dans `backend/src/servers/api.nehosell.ts` :**

```typescript
xems: {
  enable: true,
  ttl: "7d",
  autoRotation: false, // Désactiver en développement pour stopper la "course au jeton"
  gracePeriod: 5000,
  // ...
}
```

### B. Rapport au Support XyPriss

Ce comportement doit être remonté comme un bug de conception ou une limitation du Sidecar natif. Un système de session moderne devrait autoriser des hits multiples sur un jeton "Gracié" sans que chaque hit n'invalide le jeton d'origine par une nouvelle rotation en cascade.

---

_Rapport généré le 10 Mars 2026 - Analyse Engine XyPriss v9.3.59_
