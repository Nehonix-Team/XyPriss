# XInS (XyPriss Intelligent Scaling)

**XInS** (XyPriss Intelligent Scaling) est le moteur de scalabilité dynamique et de protection de surcharge natif de XyPriss. Conçu pour résoudre l'un des problèmes majeurs de Node.js (la saturation de l'Event Loop sous une charge extrême), XInS utilise des algorithmes de contrôle de congestion inspirés de TCP pour garantir une stabilité à 100% avec 0 erreur, même face à des pics de plus de 5000 connexions concurrentes.

## Le Problème de l'Event Loop

Dans un serveur web classique (comme Express ou Fastify), lorsqu'un très grand nombre de requêtes arrive simultanément, Node.js essaie de toutes les traiter en même temps. 
Cela provoque :
1. Une pression énorme sur le Garbage Collector (GC).
2. Un blocage (Starvation) de l'Event Loop.
3. Une montée en flèche de la latence, des Timeouts, et souvent des crashs silencieux ou des erreurs `503`.

## Comment fonctionne XInS (Mode "auto")

XyPriss résout ce problème à la racine grâce à son architecture hybride. Le moteur natif Go (**XHSC**) se place en bouclier devant le worker Node.js et agit comme un régulateur de flux intelligent.

Lorsque la configuration `workerPool.config.maxConcurrentTasks` est définie sur `"auto"`, XInS active son **algorithme AIMD (Additive Increase / Multiplicative Decrease)** :

1. **Surveillance en temps réel** : XHSC mesure le temps de traitement pur de chaque requête par le worker TypeScript.
2. **Additive Increase (Montée en charge progressive)** : Si la latence de traitement est excellente (ex: < 50ms), XInS ouvre les vannes rapidement en autorisant plus de requêtes simultanées (+50 requêtes concurrentes à chaque cycle d'évaluation).
3. **Multiplicative Decrease (Protection active)** : Si Node.js commence à souffrir et que la latence dépasse un seuil de sécurité (ex: > 500ms), XInS réduit instantanément la concurrence autorisée de 25% (multiplication par `0.75`).
4. **Mise en attente côté Kernel** : Au lieu de rejeter les requêtes excédentaires, XHSC les met en attente dans les Goroutines de Go (qui sont extrêmement légères et peu coûteuses) jusqu'à ce que Node.js ait digéré la vague précédente. 

Le résultat ? Un débit optimisé (jusqu'à ~6 800 requêtes/seconde sur un seul CPU) et une **stabilité absolue (0 timeout)**, quelle que soit la violence de l'attaque ou du pic de trafic.

---

## Configuration

### Activation du Mode Auto (Recommandé)

Par défaut, XyPriss est préconfiguré pour utiliser XInS de manière transparente si le WorkerPool est activé. Vous pouvez l'activer manuellement dans vos options de serveur :

```typescript
import { createServer } from "xypriss";

const app = createServer({
    server: {
        workerPool: {
            enabled: true,
            config: {
                // Active XInS (Intelligent Scaling)
                maxConcurrentTasks: "auto", 
                io: { min: "auto", max: "auto" },
                cpu: { min: "auto", max: "auto" }
            }
        }
    }
});

app.start();
```

### Ajustement Manuel (Mode Statique)

Si vous maîtrisez parfaitement les ressources de votre infrastructure et souhaitez désactiver XInS pour imposer une limite de concurrence statique, remplacez `"auto"` par une valeur numérique stricte. 

```typescript
import { createServer } from "xypriss";

const app = createServer({
    server: {
        workerPool: {
            enabled: true,
            config: {
                // XHSC n'enverra jamais plus de 1500 requêtes en même temps à Node.js
                // L'algorithme AIMD est désactivé.
                maxConcurrentTasks: 1500,
            }
        }
    }
});

app.start();
```

> [!WARNING]
> Désactiver XInS (en définissant une valeur statique ou en mettant une valeur trop élevée) peut exposer votre serveur à des Timeouts ou à des crashs de l'Event Loop si le pic de charge dépasse vos estimations. Le mode `"auto"` est fortement recommandé en production.

## Monitoring et Télémétrie

Les ajustements dynamiques effectués par XInS sont transparents pour l'application TS. Cependant, si le mode `intelligence` est activé, vous pouvez surveiller l'état du cluster via les métriques internes (ex: `/metrics` ou via le plugin de monitoring).
