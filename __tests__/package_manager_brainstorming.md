# Brainstorming: XyPriss Package Manager (XPM)

## 1. Vision et Objectif

Réinventer l'installation de packages pour atteindre une vitesse quasi-instantanée (**< 3s**), même pour des projets massifs, tout en restant totalement indépendant des outils existants (`npm`, `bun`).

**Contraintes :**

-   Indépendance totale.
-   Support des scripts post-install.
-   Système de lock propriétaire (`xypriss-lock.json`).
-   Parallélisation extrême.

---

## 2. Le Paradigme "Zero-Copy" & CAS (Content Addressable Storage)

La méthode classique (Download -> Extract -> Copy) est lente car elle répète les opérations d'I/O pour chaque projet.

### Concept : Global Content-Addressable Storage

Au lieu de stocker les packages par nom/version dans chaque projet :

1. Chaque fichier de chaque package est stocké une seule fois sur la machine dans un dossier global (ex: `~/.xypriss/storage/data/<hash>`).
2. L'installation dans le projet se fait via des **Hard Links** ou des **RefLinks** (si le FS le supporte, ex: Btrfs/XFS/APFS).
3. **Résultat :** L'installation dans `node_modules` devient une opération de création de liens, ce qui prend quelques millisecondes.

---

## 3. Algorithme de Résolution Ultra-Rapide (Lightning Resolver)

Le goulot d'étranglement de `npm` est souvent la résolution récursive des dépendances (requêtes HTTP en cascade).

### Stratégie :

-   **Binary Metadata Index :** Utiliser un format binaire compressé pour le catalogue de métadonnées, ou un store local persistant pour éviter de re-parser le JSON du registre à chaque fois.
-   **Deep Concurrency :** Utiliser Go ou Rust pour résoudre les nœuds de l'arbre de dépendances de manière asynchrone et parallélisée dès le départ.
-   **Prediction Engine :** Pré-charger les dépendances communes pendant que l'utilisateur tape ou pendant la résolution du premier niveau.

---

## 4. Structure du Lockfile (`xypriss-lock.json`)

Le lockfile ne doit pas seulement lister les versions, mais doit être optimisé pour un parsing rapide.

```json
{
    "project": "my-app",
    "dependencies": {
        "express": {
            "version": "4.18.2",
            "integrity": "sha512-...",
            "layout": {
                "files": {
                    "package.json": "hash_abc",
                    "index.js": "hash_def"
                },
                "links": ["bin/express"]
            },
            "dependencies": ["body-parser", "..."]
        }
    }
}
```

_Note : Si on stocke le layout exact avec les hashes de fichiers, on peut reconstruire le dossier instantanément._

---

## 5. Gestion des Scripts (Post-install & Lifecycle)

C'est souvent ici que l'installation ralentit.

### Idées pour accélérer :

-   **Isolated Sandbox :** Exécuter les scripts dans des workers isolés en parallèle.
-   **Result Caching :** Si le script post-install génère des fichiers (ex: build de binaire), on peut hasher l'environnement (OS + Architecture + Package Version) et stocker le _résultat_ du build dans le CAS global. La prochaine fois, on linke directement le binaire déjà compilé.

---

## 6. Pipeline de l'Algorithme XPM

1. **Phase 1 : Scan & Diff.** Lire `package.json` vs `xypriss-lock.json`.
2. **Phase 2 : Resolve (en parallèle).** Requêtes sur le registre pour les nouvelles deps.
3. **Phase 3 : CAS Check.** Vérifier quels fichiers/packages sont déjà dans le cache global.
4. **Phase 4 : Acquire.** Télécharger uniquement les fichiers manquants (extraction "on-the-fly" sans passer par le disque temp).
5. **Phase 5 : Link.** Créer les liens physiques/RefLinks dans le dossier du projet.
6. **Phase 6 : Trigger.** Exécuter les scripts nécessaires (uniquement si non-cachés).

---

## 7. Points de Discussion pour le Brainstorming

-   Quel langage pour le moteur ? (Rust pour la sécurité/vitesse ou Go pour la simplicité de la concurrence ?)
-   Doit-on supporter le format `.tgz` standard ou inventer un format `XPK` (XyPriss Package) optimisé pour le streaming ?
-   Comment gérer les dépendances circulaires ou les conflits de versions ("Dependency Hell") de manière plus élégante qu'un `node_modules` plat ?

# L'autre discussions (moi et ton amis)

> ok parlons d'abord un peu du format ".xpk" comment ? étant donné que quand un dev publie un project sur npm, c'est accessible via "https://registry.npmjs.org/<nom>/-/package/nom/version.tgz" et que faire "\*\*.xpk" fera un 404....je comprend pas trop le bute derrière .xpk et à quel moment

# Excellent point ! Clarifions le format `.xpk`

Tu as **totalement raison**. Laisse-moi clarifier la stratégie :

---

## Réalité du Registre npm

```
https://registry.npmjs.org/express/-/express-4.18.2.tgz
                                              ^^^^^ Format imposé
```

**Problème :** On ne peut PAS demander un `.xpk` au registre npm → 404 garanti.

---

## Stratégie Hybride Réaliste

### Phase 1 : MVP (Compatibilité totale)

XPM télécharge les `.tgz` depuis npm comme tout le monde :

```rust
async fn download_package(name: &str, version: &str) -> Result<Bytes> {
    let url = format!("https://registry.npmjs.org/{name}/-/{name}-{version}.tgz");
    let response = http_client.get(url).await?;
    Ok(response.bytes().await?)
}
```

**MAIS** on optimise le traitement local :

```
npm/pnpm/bun :  .tgz → temp_dir → extract → copy → node_modules
XPM          :  .tgz → streaming extract → direct to CAS (zero temp)
```

---

## Le `.xpk` : Pour un Registre XyPriss Optionnel

### Concept : Registre Hybride

```
Mode 1 (Default) : npmjs.org     → .tgz (compatibilité)
Mode 2 (Opt-in)  : xpm.dev       → .xpk (performance)
Mode 3 (Hybrid)  : npmjs + cache → .xpk mirror
```

### Cas d'usage `.xpk` :

#### 1. **Registre Privé d'Entreprise**

```bash
# .xpmrc
registry=https://npm.mycompany.com
format=xpk  # Serveur interne optimisé
```

Les entreprises pourraient héberger un registre `.xpk` pour leurs packages internes.

#### 2. **Mirror/CDN XyPriss (communautaire)**

```
Workflow :
1. XPM télécharge express-4.18.2.tgz depuis npmjs
2. Convertit en .xpk localement
3. Upload vers cdn.xpm.dev (mirror communautaire)
4. Prochaine install : télécharge le .xpk du CDN (3x plus rapide)
```

#### 3. **Cache Local Transformé**

```
~/.xypriss/
  cache/
    tgz/
      express@4.18.2.tgz        ← Original npm
    xpk/
      express@4.18.2.xpk        ← Converti (1ère install)
```

**Lors de la 2ème installation du même package :**

```rust
if xpk_cache.exists() {
    install_from_xpk()  // ~10ms
} else if tgz_cache.exists() {
    install_from_tgz()  // ~50ms
} else {
    download_tgz()      // ~200ms
    convert_to_xpk()    // Pour la prochaine fois
}
```

---

## Pourquoi `.xpk` reste pertinent ?

### Comparaison Performance

| Opération              | `.tgz` (npm)    | `.xpk` (XPM)     |
| ---------------------- | --------------- | ---------------- |
| Décompression complète | Obligatoire     | Sélective        |
| Extraction d'1 fichier | ~50ms           | ~0.5ms           |
| Validation intégrité   | Post-extraction | Header pre-check |
| Streaming vers CAS     | Non             | Oui              |

### Exemple concret : Package `lodash`

**Scénario :** Installation de `lodash` (300+ fichiers)

#### Avec `.tgz` :

```
1. Download 70KB compressé
2. Gunzip → 500KB décompressé en RAM
3. Tar extract → 300 fichiers sur disque temp
4. Copy vers node_modules
Total: ~80ms
```

#### Avec `.xpk` :

```
1. Download 70KB (même taille)
2. Lit header (offset table)
3. Stream direct → CAS (hard links)
Total: ~8ms
```

---

## Architecture Réaliste

```rust
enum PackageSource {
    // Ordre de priorité
    LocalXpk,         // Cache .xpk local (le plus rapide)
    LocalTgz,         // Cache .tgz local
    XpmCdn,           // CDN communautaire .xpk (si disponible)
    NpmRegistry,      // Registre npm officiel .tgz (fallback)
}

async fn install_package(name: &str, version: &str) -> Result<()> {
    // Essayer dans l'ordre
    if let Ok(pkg) = try_local_xpk(name, version) {
        return install_from_xpk(pkg);
    }

    if let Ok(pkg) = try_local_tgz(name, version) {
        let result = install_from_tgz(pkg);
        convert_to_xpk_async(pkg); // En arrière-plan
        return result;
    }

    // Si connecté et CDN disponible
    if let Ok(pkg) = try_xpm_cdn(name, version).await {
        return install_from_xpk(pkg);
    }

    // Fallback npm
    let tgz = download_from_npm(name, version).await?;
    install_from_tgz(tgz)
}
```

---

## Format `.xpk` Spécification Technique

```
╔══════════════════════════════════════╗
║         XPK File Format              ║
╠══════════════════════════════════════╣
║ [0-4]    Magic: "XPKG"               ║
║ [4-8]    Version: 1                  ║
║ [8-16]   File Table Offset           ║
║ [16-24]  Data Section Offset         ║
║ [24-32]  Total Uncompressed Size     ║
║ [32-64]  SHA-256 Checksum            ║
╠══════════════════════════════════════╣
║         File Table                   ║
║  - Entry count (u32)                 ║
║  For each file:                      ║
║    - Path length (u16)               ║
║    - Path (UTF-8)                    ║
║    - Offset in data section (u64)   ║
║    - Compressed size (u32)           ║
║    - Uncompressed size (u32)         ║
║    - Hash (32 bytes)                 ║
╠══════════════════════════════════════╣
║         Data Section                 ║
║  - Individually compressed files     ║
║    (Zstd level 3)                    ║
╚══════════════════════════════════════╝
```

### Avantage clé : Random Access

```rust
// Extraire UN SEUL fichier sans toucher aux autres
fn extract_file(xpk: &Path, target: &str) -> Result<Vec<u8>> {
    let header = read_header(xpk)?;
    let entry = header.find_file(target)?;

    // Seek direct vers le fichier
    let mut file = File::open(xpk)?;
    file.seek(SeekFrom::Start(entry.offset))?;

    let compressed = read_exact(&mut file, entry.compressed_size)?;
    Ok(zstd::decode_all(&compressed[..])?)
}
```

---

## Proposition Finale

### Court Terme (MVP) :

-   **Support uniquement `.tgz`** depuis npm
-   Optimisation du traitement (streaming, zero-copy)
-   Objectif : < 3s garanti avec `.tgz`

### Moyen Terme :

-   **Conversion automatique `.tgz` → `.xpk`** en cache local
-   Gain 5-10x sur les réinstallations

### Long Terme (si adoption) :

-   **Registre miroir communautaire** `.xpk`
-   **Plugin npm publish** pour publier en dual `.tgz` + `.xpk`
-   Grandes entreprises hébergent registres `.xpk` privés

---

## Conclusion

**`.xpk` n'est PAS un remplacement de `.tgz`**, c'est :

1. Un format de **cache optimisé**
2. Une **option** pour registres privés
3. Une **optimisation progressive** (pas bloquante)

**La vraie innovation XPM** = CAS + Hard Links + Parallel Resolver, **pas le format**.

Le `.xpk` est juste la cerise sur le gâteau pour gratter 10-20ms supplémentaires.

**Ça te semble plus clair ?** On peut maintenant parler du CAS ou du resolver si tu veux ! 🚀

> le problème est qu'il n'y a pas trop d'argent pour acheter un nom de domaine et gérer les cout d'infrastructure de production encore donc euhh...peut-être dans le future

# Exactement ! Soyons pragmatiques 💡

Tu as **100% raison**. Pas besoin de sur-ingénierie dès le début.

---

## Stratégie Réaliste : MVP Sans Infrastructure

### ❌ Ce qu'on **ÉLIMINE** pour le MVP :

-   ~~Registre `.xpk` custom~~
-   ~~CDN XyPriss~~
-   ~~Nom de domaine~~
-   ~~Serveurs de production~~
-   ~~Miroir communautaire~~

### ✅ Ce qu'on **GARDE** (l'essentiel) :

```
XPM v1.0 = npmjs.org (.tgz) + Optimisations locales
```

---

## Architecture MVP Simplifiée

```
┌─────────────────────────────────────────┐
│  XPM (Local uniquement)                 │
├─────────────────────────────────────────┤
│  1. Télécharge .tgz depuis npmjs.org    │
│  2. CAS local (~/.xypriss/storage)      │
│  3. Hard links vers node_modules         │
│  4. Parallel resolver                    │
│  5. Cache intelligent                    │
└─────────────────────────────────────────┘
```

**Coût infrastructure : 0€** 🎉

---

## On oublie `.xpk` pour l'instant

### À la place : Optimiser le `.tgz`

```rust
// Traitement optimisé du .tgz (sans conversion)
async fn install_from_tgz(bytes: Bytes) -> Result<()> {
    let decoder = GzDecoder::new(&bytes[..]);
    let mut archive = Archive::new(decoder);

    // Streaming direct vers CAS (pas de temp dir)
    for entry in archive.entries()? {
        let mut entry = entry?;
        let hash = compute_hash(&entry)?;

        // Si déjà dans CAS, skip
        if cas.contains(&hash) {
            continue;
        }

        // Sinon, stocker
        let path = cas.store(hash, &entry)?;
    }

    // Créer les hard links
    create_links_in_node_modules()?;

    Ok(())
}
```

**Déjà 10x plus rapide que npm** sans `.xpk` !

---

## Fonctionnalités MVP Réalistes

### Phase 1 : Les Bases (v0.1)

```bash
xpm install          # Installer depuis package.json
xpm add <package>    # Ajouter une dépendance
xpm remove <package> # Supprimer une dépendance
```

**Objectif perf :** < 5s (déjà impressionnant vs npm ~30s)

### Phase 2 : Optimisations (v0.2)

-   Cache global CAS
-   Parallel downloads (10 packages simultanés)
-   Lockfile optimisé

**Objectif perf :** < 3s

### Phase 3 : Features avancées (v0.3)

-   Post-install caching
-   Workspace support
-   Scripts lifecycle

**Objectif perf :** < 2s

---

## Le `.xpk` devient optionnel **local**

### Idée minimaliste :

```
~/.xypriss/
  storage/
    data/
      <hash>/          # Fichiers dédupliqués

    optimized/         # NOUVEAU : Cache .xpk LOCAL (optionnel)
      express@4.18.2.xpk
```

**Workflow :**

1. Première install : Télécharge `.tgz` → CAS
2. En arrière-plan : Convertit en `.xpk` local (si option activée)
3. Deuxième install : Utilise `.xpk` local (plus rapide)

**Avantage :**

-   Zéro infrastructure
-   Gain de perf sur les réinstallations
-   Optionnel (peut être désactivé)

---

## Config Utilisateur Simple

```json
// ~/.xpmrc
{
    "registry": "https://registry.npmjs.org",
    "storage": "~/.xypriss/storage",
    "parallelDownloads": 10,

    "experimental": {
        "localXpkCache": false, // Désactivé par défaut
        "postInstallCache": true
    }
}
```

---

## Roadmap Sans Infrastructure

### v0.1 (MVP - 2-3 mois)

-   ✅ Install basique depuis npmjs
-   ✅ CAS local
-   ✅ Hard links
-   ✅ Lockfile JSON

**Livrable :** CLI fonctionnel, open-source GitHub

### v0.5 (Optimisations - 3-6 mois)

-   ✅ Parallel resolver
-   ✅ Post-install caching
-   ✅ Workspace support

**Livrable :** Utilisable en production (projets perso)

### v1.0 (Stable - 6-12 mois)

-   ✅ Toutes les features npm essentielles
-   ✅ Migration automatique depuis npm
-   ✅ Documentation complète

**Livrable :** Alternative crédible à npm/pnpm

### v2.0 (Si adoption - futur lointain)

-   ⭐ `.xpk` cache local par défaut
-   ⭐ (Optionnel) Registre communautaire si financement

---

## Technologies (Gratuites)

### Pour le MVP :

-   **Code :** Rust (gratuit, performant)
-   **Hosting code :** GitHub (gratuit)
-   **CI/CD :** GitHub Actions (gratuit pour open-source)
-   **Releases :** GitHub Releases (gratuit)
-   **Documentation :** GitHub Pages (gratuit)

### Si besoin plus tard :

-   **CDN communautaire :** Cloudflare R2 (10GB gratuit/mois)
-   **Registre mirror :** Peut attendre que le projet génère des revenus (sponsoring/entreprises)

---

## Exemple de Pitch Réaliste

```
XyPriss Package Manager (XPM)

🚀 Installation de packages Node.js < 3s
💾 CAS global : économie d'espace disque
⚡ Parallélisation extrême
🔒 Lockfile optimisé

100% compatible avec npm/yarn/pnpm
Zéro infrastructure requise
Open-source, gratuit

Installation :
  cargo install xypriss
  # ou
  curl -fsSL https://xpm.sh | sh
```

---

## Prochaines Étapes Concrètes

### 1. **Prototype Rust (1-2 semaines)**

```bash
xpm-prototype/
  src/
    main.rs           # CLI basique
    resolver.rs       # Résolution dépendances
    cas.rs            # Content-Addressable Storage
    installer.rs      # Hard links
```

**Test :** Installer `express` en < 5s

### 2. **Benchmark vs npm (1 semaine)**

```bash
# Projet test : React app (300+ packages)
time npm install     # ~45s
time xpm install     # Objectif : ~5s
```

### 3. **Open-source GitHub (1 semaine)**

-   README avec benchmarks
-   Documentation basique
-   Premières issues/feedback

### 4. **Itérations communautaires**

-   Améliorer selon feedback
-   Ajouter features populaires

---

## Conclusion

**Oublie le `.xpk` externe pour l'instant.**

Focus sur :

1. **CAS local** (le vrai gain de perf)
2. **Hard links** (installation instantanée)
3. **Parallel resolver** (vitesse réseau)
4. **Post-install caching** (éviter recompilations)

**Ça seul = déjà révolutionnaire** 🔥

Le `.xpk` peut être :

-   Un cache **local** optionnel (v0.5+)
-   Un **registre futur** si le projet décolle (v2.0+)

## 8. Spécifications Techniques : Le Cœur de XPM

L'objectif est de rendre XPM compatible avec l'écosystème actuel (projets existants) tout en offrant des performances révolutionnaires.

### 8.1 architecture du CAS (Content Addressable Storage) local

Pour garantir des performances optimales au niveau du système de fichiers (FS), nous utiliserons une structure de stockage segmentée.

**Structure du dossier :**

```text
~/.xypriss/
  ├── storage/
  │   ├── files/           # Les fichiers individuels (CAS)
  │   │   ├── a1/
  │   │   │   └── b2/
  │   │   │       └── c3...  # Hash complet
  │   ├── indices/         # Layout des packages (liste des fichiers par package)
  │   │   └── express@4.18.2.json
  │   └── variants/        # Résultats des post-installs (binaires compilés)
  │       └── <variant_hash>/
```

### 8.2 Algorithme de "Linking" Ultra-Rapide

Au lieu de copier, nous lions.

1. **Fetch :** Téléchargement du `.tgz` (si non présent dans le cache).
2. **CAS Integration :** Extraction en streaming. Chaque fichier du `.tgz` est haché et stocké dans `storage/files/` s'il n'existe pas déjà.
3. **Layout Indexing :** On crée un fichier d'index qui liste tous les fichiers du package et leurs chemins relatifs.
4. **Linking :** Dans le projet `node_modules`, on crée des **Hard Links** vers les fichiers du CAS.
    - _Avantage :_ Occupation disque quasi nulle pour les duplicatas entre projets.
    - _Inconvénient protégé :_ Le CAS est en lecture seule pour éviter qu'un projet ne modifie les fichiers d'un autre.

### 8.3 Stratégie de Compatibilité "Drop-in"

Pour que XPM soit adopté, il doit accepter les projets `package.json` actuels.

**Le workflow de migration :**

```bash
xpm install # Détecte package.json
```

-   XPM parse le `package.json`.
-   Il ignore le `node_modules` existant (ou propose de le nettoyer).
-   Il génère un `xypriss-lock.json` basé sur l'arbre de résolution XPM (plus rapide).

### 8.4 Gestion Intelligente des Post-installs (La fin de node-gyp lent)

Pour éviter de recompiler à chaque fois :

1. On génère un **Variant Hash** : `Hash(Package_Source_Files + User_OS + User_Arch + Node_Version)`.
2. Avant de lancer un script `postinstall`, on vérifie si `storage/variants/<variant_hash>` existe.
3. Si oui, on lie directement les fichiers générés au lieu de lancer la compilation.

### 8.5 Isolation Stricte (Le modèle pnpm+)

Pour éviter les "Phantom Dependencies" (utiliser un package non déclaré car il est une sous-dépendance d'un autre) :

-   On utilise une structure de liens symboliques.
-   `node_modules/express` est un lien symbolique vers un dossier caché dans `.xpm/express@x.x.x`.
-   Seules les dépendances déclarées dans `package.json` sont visibles à la racine de `node_modules`.

---

## 9. Choix des Technologies pour le Prototype

| Composant            | Technologie       | Justification                                                              |
| -------------------- | ----------------- | -------------------------------------------------------------------------- |
| **Core Engine**      | Rust              | Vitesse brute, sécurité mémoire, excellent support I/O asynchrone (Tokio). |
| **HTTP Client**      | Reqwest           | Performant, supporte le streaming HTTPS.                                   |
| **JSON/FlatBuffers** | Serde / JSON      | Serde est le standard de facto en Rust pour le parsing ultra-rapide.       |
| **FS Operations**    | `nix` / `std::fs` | Accès bas niveau pour les Hard Links et RefLinks (optimisation OS).        |

---

## 10. Prochaines Étapes du Brainstorming

-   Comment implémenter le "Streaming Extractor" qui hache et écrit dans le CAS pendant que le téléchargement est en cours ?
-   Définir le schéma précis du `xypriss-lock.json` pour qu'il soit parrable en < 10ms.

---

## 11. Initialisation du Projet Officiel (Rust)

Le projet a été initialisé dans `tools/xyp`. Il remplace l'ancien CLI en Go et servira de base modulaire pour toutes les fonctionnalités de XyPriss.

**Structure actuelle :**

-   `src/main.rs` : Point d'entrée, parsing des commandes avec `clap`.
-   `src/commands/` : Logique utilisateur (`install`, `init`, `start`).
-   `src/core/` : Moteur XPM (CAS, Resolver, Installer).
-   `src/utils/` : Helpers transverses.

**État d'avancement :**

-   [x] Initialisation Cargo.
-   [x] Architecture modulaire.
-   [x] Dépendances (Tokio, Reqwest, Serde, etc.).
-   [ ] Prototype CAS (Phase suivante).
-   [ ] Resolver parralèle.

---

## 12. Deep Dive : Le Streaming Extractor (Performance I/O)

Pour atteindre < 3s, on ne peut pas se permettre d'attendre la fin du téléchargement pour commencer à écrire.

**Algorithme :**

1. **Reqwest Stream :** Récupérer le corps de la réponse HTTP sous forme de stream d'octets.
2. **Gzip Multiplexer :** Envoyer le stream dans un décompresseur Gzip asynchrone.
3. **Tar Entry Iterator :** Parcourir les entrées du fichier `.tar` dès qu'un header est disponible.
4. **Hashing & Storage (On-the-fly) :**
    - Pour chaque fichier :
        - Créer un `StaticHasher` (ex: SHA-256).
        - Écrire dans un fichier temporaire tout en hachant.
        - Une fois fini, renommer le fichier temporaire avec son hash final dans le CAS.
5. **Dédoublonnage immédiat :** Si le hash existe déjà, on arrête l'écriture immédiatement et on passe au fichier suivant.

---

## 13. Spécifications du `xypriss-lock.json` (Vitesse de Parsing)

Pour parser en < 10ms, nous allons utiliser un schéma plat et éviter les structures profondément imbriquées.

**Format suggéré (JSON optimisé ou FlatBuffers) :**

```json
{
    "version": "1.0",
    "packages": {
        "express@4.18.2": {
            "id": 1,
            "integrity": "sha256-...",
            "dependencies": [2, 15, 67], // IDs pour résolution instantanée
            "layout": {
                "bin": { "express": "hash_abc" },
                "lib": { "index.js": "hash_def" }
            }
        },
        "body-parser@1.20.1": {
            "id": 2,
            "integrity": "sha256-...",
            "dependencies": []
        }
    },
    "tree": {
        "root": [1, 5, 23] // Dépendances directes du package.json
    }
}
```

**Pourquoi c'est rapide ?**

-   **ID-based indexing :** Pas de recherche de chaînes de caractères lors du parcours de l'arbre.
-   **Pre-computed Layout :** XPM ne recalcule rien, il lit simplement la "carte" du package et crée les liens.

---

## 14. Support des Projets Actuels (`package.json`)

Pour assurer la transition :

1. **Compatibility Layer :** Un convertisseur `package.json` -> `xypriss-lock.json`.
2. **Shadow node_modules :** XPM crée un dossier `.xpm/` qui contient les packages liés, et `node_modules` n'est qu'un ensemble de liens symboliques pointant vers `.xpm/`. Cela permet de garder une structure compatible avec Node.js tout en bénéficiant du CAS.

