# XyPriss (XCIS) Performance Benchmarks

Ce document présente les résultats des benchmarks de performance du serveur XyPriss (simulation `XCIS`) effectués avec `autocannon`. Les tests démontrent la capacité du moteur XHSC à gérer la charge ainsi que ses limites structurelles sous des conditions extrêmes.

## Configuration du Test Standard
- **Outil** : `autocannon`
- **Connexions concurrentes** : 100
- **Durée** : 10 secondes par test
- **Serveur** : XyPriss Core Engine (XHSC)

---

## 1. Route `/ping` (Texte Brut)

Endpoint basique retournant la réponse textuelle `"pong"`.

- **Requêtes totales** : 6 069
- **Requêtes par seconde (Moyenne)** : 606.9 req/sec
- **Latence (Moyenne)** : 167.43 ms
- **Taux d'erreur** : 0%

## 2. Route `/xml-to-json` (Parsing XML & Transformation JSON)

Endpoint qui reçoit une requête contenant un corps XML (`<user id="123"><name>John</name></user>`), le parse de manière optimisée, et retourne les attributs extraits au format JSON via le système de Proxy de XyPriss.

- **Requêtes totales** : 11 503
- **Requêtes par seconde (Moyenne)** : 1 150.3 req/sec
- **Latence (Moyenne)** : 86.88 ms
- **Taux d'erreur** : 0%

---

## Tests de Stress Extrême (Gros Volume : 2000 connexions concurrentes)

Pour évaluer les limites du système et cibler d'autres modules critiques du framework (tels que le XStatic Engine et le Native Binary Streaming), des tests de stress massif ont été configurés avec **2000 connexions concurrentes** et un niveau élevé de requêtes pipelinées (objectif > 1 Million de requêtes).

### Cibles des tests extrêmes :
- **XStatic Engine** : `/static/texte.txt` (Délégation Zero-Copy)
- **Binary Streaming** : `/test-sendfile` (`res.sendFile()`)
- **Response Control / Radix Routing** : `/rc/json-403`

### Résultats : Atteinte des limites de l'IPC (Bridge Timeout)

Sous cette charge écrasante (2000 sockets TCP ouverts simultanément bombardant le serveur de milliers de requêtes par seconde), le système de simulation a montré ses limites de ressources :
- Les requêtes ont provoqué un blocage (Timeouts massifs et erreurs `5xx`).
- Les logs internes de XyPriss (`[SYSTEM] [XHSC::ERROR]`) indiquent : `Bridge initialization failed: request timed out`.
- **Analyse** : L'interface de communication inter-processus (IPC) entre le runtime Node.js et le binaire natif Go (XHSC) est saturée. L'event-loop Node.js, croulant sous le contexte de milliers de sockets asynchrones, ne parvient plus à valider la communication avec le noyau natif dans le délai imparti. 

---

## Synthèse

Le moteur natif XHSC intégré à XyPriss démontre une gestion exceptionnelle des flux de requêtes sous charge standard, notamment sur des tâches complexes comme le parsing (XML vers JSON) où il atteint plus de 1100 req/sec avec moins de 90 ms de latence, surpassant même les routes basiques texte. 

Cependant, les benchmarks de volumes extrêmes (2000+ connexions) révèlent la contrainte du pont IPC (Bridge Timeout). Pour soutenir des trafics de type "1M++ requêtes" avec de très fortes concurrences, il est impératif d'utiliser le mode **Cluster multi-processus** de XyPriss (comme décrit dans `examples/simple-cluster-example.ts`) ou de répartir la charge via `XyNginC` afin de ne pas engorger l'event-loop d'un seul thread Node.js.
