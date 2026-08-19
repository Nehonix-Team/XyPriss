# Nouveautés XyPriss : Multi-Prefixes & Utilitaires d'Objets Avancés

Ce document récapitule les fonctionnalités introduites dans **XyPriss 9.12.50**.

---

## 1. Support des Préfixes Multiples (`string | string[]`) dans `Router.group()`

### Contexte
Permet de monter un même ensemble de routes sur plusieurs chemins sans dupliquer le callback de déclaration.

### Syntaxe
```typescript
import { Router } from "xypriss";

const r = new Router();

// Montage simultané sur /client-api et /api
r.group({ prefix: ["/client-api", "/api"], serverId: "client.server" }, (clientApi) => {
  clientApi.get("/me", (req, res) => res.json({ user: req.user }));
  clientApi.get("/status", (req, res) => res.success("OK"));
});
```

### Caractéristiques :
- Le callback est exécuté une seule fois.
- Toutes les options du groupe (`serverId`, `guards`, `rateLimit`, `middleware`, `meta`, `active`) s'appliquent automatiquement à chaque préfixe.
- Compatible avec le multi-serveur XMS et l'isolation `serverId`.

---

## 2. Utilitaires d'Objets Avancés (`ObjectUtils` & `ObjectWrapper`)

Accessible via `__sys__.utils.obj` ou `obj.of(...)`.

### Méthodes d'Inspection

#### `hasEmpty(keys?, options?)` / `hasAnyEmpty(keys?, options?)`
Renvoie `true` si au moins une valeur de l'objet est vide (`undefined`, `null`, chaîne vide `""`, tableau vide `[]`, ou objet vide `{}`).

```typescript
const contact = __sys__.utils.obj.of({
  name: "Alice",
  phone: undefined,
  email: "",
});

contact.hasEmpty(); // true (phone ou email vide)
contact.hasEmpty(["name"]); // false (name est renseigné)
```

#### `isAllEmpty(keys?, options?)`
Renvoie `true` si **toutes** les valeurs de l'objet (ou des clés ciblées) sont vides.

```typescript
const emptyForm = __sys__.utils.obj.of({
  name: undefined,
  phone: "",
  email: null,
});

emptyForm.isAllEmpty(); // true
```

#### `hasUndefined(keys?)`
Renvoie `true` si au moins une valeur est strictement `undefined`.

```typescript
__sys__.utils.obj.hasUndefined({ a: "ok", b: undefined }); // true
__sys__.utils.obj.hasUndefined({ a: "ok", b: null });      // false
```

#### `compact(options?)`
Retourne un nouvel objet débarrassé de toutes les propriétés `undefined`, `null` et chaînes vides `""`.

```typescript
const clean = __sys__.utils.obj.of({
  name: "Alice",
  phone: "+22501020304",
  email: "",
  notes: null,
}).compact().value();

// Résultat :
// { name: "Alice", phone: "+22501020304" }
```
