# Feature Request : Extension de l'API XyGuard pour les guards personnalisés déclaratifs

## Contexte

Actuellement, le moteur de routage de XyPriss permet d'enregistrer une logique globale pour l'autorisation via l'API `XyGuard.define(name, resolver)`.

Cependant, le typage TypeScript de cette méthode restreint strictement l'argument `name` aux trois types standards définis par le framework :

- `"authenticated"`
- `"roles"`
- `"permissions"`

_(Signature actuelle : `(method) XyGuard.define(name: "authenticated" | "roles" | "permissions", resolver: ...)`)_
 
## Limitation rencontrée

Lorsqu'un développeur souhaite créer un guard global personnalisé (par exemple `"streamAuth"` ou `"ipWhitelist"`) pour l'utiliser de manière déclarative dans ses options de route via la syntaxe objet (ex: `{ guards: { streamAuth: true } }`), TypeScript lève une erreur car la clé n'est pas reconnue par le type de l'API.

Bien qu'il soit possible de contourner cela en passant une fonction en ligne dans un tableau (`{ guards: [streamAuthGuard] }`), cela casse la cohérence de l'API déclarative pour les guards personnalisés réutilisables.

## Comportement attendu (Proposition)

Il serait idéal que l'API `XyGuard` permette d'enregistrer des guards nommés arbitrairement tout en préservant le typage strict.

**Solutions possibles :**

1. **Surcharge TypeScript (Declaration Merging)** : Permettre aux développeurs d'étendre l'interface interne (ex: `IXyGuardTypes`) via un fichier `.d.ts` dans leur projet, afin que TypeScript accepte les nouveaux noms.
2. **Type Générique / String** : Élargir le type de l'argument `name` à `string` dans `XyGuard.define()`, pour accepter l'enregistrement dynamique de n'importe quel guard nommé.

## Exemple d'utilisation souhaité (sans erreur TS)

```typescript
// Définition
XyGuard.define("monGuardCustom", (req) => {
    return true;
});

// Utilisation
router.post(
    "/action",
    { guards: { monGuardCustom: true } },
    Controller.handler,
);
```

Ce support améliorerait l'extensibilité du framework tout en conservant son excellente Developer Experience (DX).

