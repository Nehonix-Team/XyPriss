# XyPriss Console Interceptor (XCI) Guide

## Overview

The XyPriss Console Interceptor (XCI) is a high-performance subsystem integrated into the native XHSC (XyPriss Hyper-System Core). It facilitates the systematic ingestion, processing, and redirection of all standard output and error streams (`console` methods) through a unified architectural bridge. This system provides critical capabilities for enterprise-grade logging, cryptographic security, and real-time monitoring.

## Core Capabilities

- **Unified Stream Management**: Consolidation of all console output into a single, manageable pipeline.
- **Native Processing**: High-efficiency filtering and categorization performed by XHSC.
- **Cryptographic Security**: Native AES-GCM encryption for sensitive log data.
- **Source Attribution**: Automatic metadata attachment for origin tracking and debugging.
- **Rate Limiting**: Protection against log-based DoS attacks through native-level throttling.

## Technical Architecture

The system operates via a bridge between the TypeScript application layer and the native XHSC core. When enabled, the native engine intercepts standard output at the process level, performs necessary transformations (filtering, encryption), and redistributes the processed logs to secondary sinks or plugin hooks.

### Execution Modes

| Mode          | Description                                                                       |
| ------------- | --------------------------------------------------------------------------------- |
| `original`    | Standard output formatting is maintained; metadata is attached in the background. |
| `intercepted` | Output is processed and formatted according to the unified logging schema.        |
| `both`        | Simultaneous delivery of both raw and processed log streams.                      |
| `none`        | Streams are captured and processed without local terminal output.                 |

## Configuration

The system is configured during the server initialization sequence via the `logging` configuration object.

### Comprehensive Configuration Schema

```ts
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            interceptMethods: ["log", "error", "warn", "info", "debug"],
            preserveOriginal: {
                enabled: true,
                mode: "intercepted",
                showPrefix: true,
                colorize: true,
            },
            performanceMode: true,
            maxInterceptionsPerSecond: 1000,
            sourceMapping: true,
            filters: {
                minLevel: "info",
                excludePatterns: ["node_modules", "internal"],
            },
        },
    },
});
```

## Formatting and Display Engine (`preserveOriginal`)

The `preserveOriginal` configuration block controls exactly how intercepted logs are rendered in your terminal. This operates natively within TypeScript on the results processed by the XHSC engine.

```typescript
preserveOriginal: {
    enabled: true,
    mode: "intercepted",
    showPrefix: true,
    colorize: true,
    separateStreams: true,
    allowDuplication: false,
    onlyUserApp: true,
    customPrefix: "[MyApp]"
}
```

### Configuration Options:

- **`mode`**: Définit la stratégie d'affichage.
    - `"intercepted"`: Affiche le log préfixé, colorisé et formatté par le moteur Go.
    - `"original"`: Ignore le résultat du moteur Go pour l'affichage console et applique localement _customPrefix_ et _colorize_ sur les données brutes.
    - `"both"`: Affiche les deux types de trace.
    - `"none"`: Stoppe totalement l'affichage du log dans la console de l'application gérée. Le log reste intercepté et transmis aux hooks de vos plugins en arrière plan de manière totalement silencieuse.

- **`showPrefix`**: Ajoute le préfixe avant le texte du log (ex: natif `[SYSTEM][W0]` ou custom de `customPrefix`).

- **`customPrefix`**: Remplace le préfixe implicite par une chaîne de caractères spécifique (Valable uniquement en mode `"original"` ou `"both"`).

- **`colorize`**: Active la coloration syntaxique ANSI. En mode `"original"`, cela colorise le `customPrefix` en cyan et teinte les messages `error`/`warn` respectavement en rouge et jaune.

- **`separateStreams`**: Redirige dynamiquement les flux. Si actif, passe tous vos `console.error` et `console.warn` vers `stderr`, tout en maintenant ceux de type trace ou info sur `stdout`. Sans option, tout est unifié sur `stdout`.

- **`allowDuplication`**: Protège l'intégrité de votre console contre le spam et les boucles. Lorsqu'il vaut `false`, le moteur de déduplication scrute les 20 derniers messages interceptés de la fenêtre courrante et **supprime** instantanément toute copie exacte (dépourvue des décalages d'horodatage). C'est parfait pour mitiger un `console.log()` pris dans un `setInterval()`.

- **`onlyUserApp`**: Fonctionne comme un filtre "Mode Strict". Même en mode `"intercepted"`, seuls les logs identifiés nativement comme `[USERAPP]` par le moteur Go (via la regex de la configuration `userAppPatterns`) seront affichés. Le reste comme `[SYSTEM]` sera intercepté mais visuellement caché.

## Advanced Technical Features

### Cryptographic Log Protection

The system supports native-level encryption using the AES-GCM algorithm. This ensures that sensitive console data is secured prior to persistent storage or transmission over unsecured channels.

```ts
encryption: {
    enabled: true,
    key: process.env.CONSOLE_ENCRYPTION_KEY,
    algorithm: "aes-256-gcm",
    displayMode: "encrypted",
}
```

### Native Rate Limiting

To prevent system exhaustion, the XHSC core implements native rate limiting. Limits are enforced at the source, ensuring that application-level recursions or high-frequency logging do not degrade overall system performance.

## Runtime Management API

The `XyprissApp` instance provides several methods for runtime management of the interception system.

### Configuration Updates

```ts
const interceptor = app.getConsoleInterceptor();

await interceptor.updateConfig({
    filters: {
        minLevel: "error",
    },
});
```

### Performance Monitoring

Statistics and performance metrics can be retrieved to monitor the operational impact of the logging subsystem.

```typescript
const stats = await app.getConsoleStats();
/*
{
    totalInterceptions: 5000,
    interceptionsPerSecond: 120,
    averageOverhead: 0.15, // in milliseconds
    isActive: true
}
*/
```

## Implementation Best Practices

1.  **Production Environments**: Utilize `intercepted` mode to ensure logs are correctly categorized and metadata is preserved.
2.  **Security**: Always enable encryption when logging sensitive application state or transaction details.
3.  **Performance**: Set rational `maxInterceptionsPerSecond` limits to protect system resources.
4.  **Debugging**: Use `mode: 'both'` during integration phases to verify log integrity.

## Troubleshooting

### Indeterminate Output

Verify the `preserveOriginal.mode` setting. If set to `none`, logs are processed internally but not rendered to the local console.

### Performance Overhead

If overhead exceeds desired thresholds, consider disabling `sourceMapping` or increasing the rate-limiting thresholds within the XHSC configuration.

## Summary

The XyPriss Console Interceptor (XCI) is an essential component for robust application management. By leveraging the native efficiency of the XHSC engine, it provides a secure, performant, and highly configurable logging infrastructure suitable for large-scale production deployments.

