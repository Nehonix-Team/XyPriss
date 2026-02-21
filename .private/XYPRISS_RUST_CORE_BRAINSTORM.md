# Brainstorming : Migration du Cœur de XyPriss vers Rust (xsys)

## Objectif

Réécrire le moteur HTTP central de XyPriss (actuellement `HttpServer.ts`) en Rust afin d'obtenir des performances maximales, une meilleure efficacité mémoire et une gestion de la concurrence supérieure, tout en conservant la flexibilité du JS/TS pour les développeurs.

## Analyse Détaillée du Flux Actuel

Basé sur l'analyse de `FastServer.ts` et `HttpServer.ts`, le flux actuel est :

1. **`http.createServer` de Node.js** reçoit une connexion TCP brute.
2. **Amélioration de la Requête** : Les objets Node.js sont enveloppés de méthodes Express-like (`res.send`, `res.json`).
3. **Chaîne de Middlewares** : Une cascade de fonctions JS asynchrones est exécutée.
4. **Routeur** : Le matching de chemin est fait via regex ou découpage de chaîne en JS.
5. **Handlers** : Le code TS défini par l'utilisateur est exécuté.

## Architecture Hybride Proposée : "Le XyPriss Rust Engine"

### 1. La Passerelle Rust (`xsys server`)

Le binaire Rust devient l'écouteur principal.

- **Stack HTTP/TLS** : Utilisation de `hyper` + `tokio` pour des I/O à la pointe.
- **Fast-Path Statique Zero-Copy** : Servir les fichiers directement depuis Rust sans jamais toucher l'écosystème Node.js.
- **Middlewares de Sécurité** : Décharger la gestion des headers (HSTS, CSP, XSS) et le Rate Limiting dans Rust.
- **Routeur basé sur Trie** : Utiliser un routeur haute performance en Rust (type `matchit`) pour identifier la cible avant même de solliciter le JS.

### 2. IPC (Communication Inter-Processus) Haute Vitesse

Puisque la logique utilisateur reste en JS/TS, un "pont" est nécessaire.

- **Options de Pont** :
    - **Unix Domain Sockets (UDS)** : Idéal pour l'IPC local avec une latence quasi nulle.
    - **Mémoire Partagée (Shared Memory)** : Plus complexe mais permet de manipuler de gros corps de requêtes sans copie (Zero-copy).
- **Flux de travail** :
    1. Rust reçoit et parse la requête HTTP.
    2. S'il s'agit d'une route dynamique, Rust prépare un "Bundle de Requête" (Headers, Chemin, Métadonnées).
    3. Rust communique avec Node.js via le canal IPC (UDS).
    4. Node.js exécute le handler TS et renvoie un "Bundle de Réponse".
    5. Rust finalise l'envoi de la réponse au client.

### 3. Intégration Modulaire

On évite le monolithe en procédant par modules Rust :

- **Module A : `xsys-http`** : Le moteur de base du serveur.
- **Module B : `xsys-router`** : La logique de routage haute vitesse.
- **Module C : `xsys-security`** : Centralisation des politiques de sécurité réseau.

## Bénéfices Stratégiques pour Nehonix

- **Sécurité** : La sécurité mémoire de Rust protège la couche réseau contre les crashs et les failles de bas niveau.
- **Crédibilité Enterprise** : Positionne XyPriss comme un framework "Rust-powered", rassurant pour les infrastructures à haute charge.
- **Utilisation CPU** : exploitation réelle du multi-threading sans la complexité du module `cluster` de Node.js.

## Feuille de Route d'Implémentation

1. **Étendre `xsys`** : Créer un module `server` dans `tools/xypriss-sys/src/`.
2. **Adapter `XyPrissRunner`** : Lui donner la capacité de piloter et de surveiller le processus serveur Rust.
3. **Refactoriser `HttpServer.ts`** : Le transformer en "consommateur d'IPC" plutôt qu'en serveur HTTP direct.
4. **Benchmarks** : Valider le gain de requêtes par seconde (RPS) et la réduction de la latence.

HTTP METHODs:
GET : Récupère une représentation de la ressource (sûre et idempotente).

HEAD : Comme GET, mais sans le corps de la réponse (seulement les en-têtes).
​

POST : Soumet des données pour créer une nouvelle ressource (non idempotente).

PUT : Remplace ou crée une ressource entière (idempotente).

PATCH : Applique des modifications partielles à une ressource.

DELETE : Supprime la ressource spécifiée (idempotente).

OPTIONS : Décrit les options de communication pour la ressource cible.

CONNECT : Établit un tunnel vers le serveur (pour proxies HTTPS).

TRACE : Effectue un test de boucle de diagnostic.
​

---

## Focus XEMS : Persistance Sécurisée (Roadmap)

### 1. Format de Fichier `.xem` (XyPriss Encrypted Managed)

L'objectif est d'avoir un fichier binaire propriétaire qui ne peut pas être lu en dehors du serveur d'origine.

- **Header Ultra-Sécurisé** :
    - Magic Bytes (`XEMS`).
    - Version du protocole.
    - Salt cryptographique.
    - **HWID-Bound** : Un hash SHA-256 combinant le CPU ID et l'adresse MAC pour verrouiller la clé au matériel.

### 2. Gestion de la Clé Maître

- **Mode Hybride** : La clé est dérivée d'une clé secrète (env var) + l'ID matériel.
- **Zero-Persistence Plaintext** : La clé résultante n'est jamais écrite sur le disque.

### 3. Nettoyage et Anti-Forensic

- **Secure Wipe** : Lorsque XEMS effectue une rotation de token, l'ancienne position sur le disque est écrasée par des bits aléatoires ou des zéros avant d'être marquée comme libre.

---

_Brainstorming mis à jour le 18/02/2026 - Focus : Persistance XEMS et Hardware Binding_

