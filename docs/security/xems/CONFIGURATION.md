# XEMS Configuration Reference

XEMS is configured via the `server.xems` property in the `createServer` options. The configuration is validated strictly during server initialization.

## Core Settings

| Parameter      | Type      | Default             | Description                                                         |
| :------------- | :-------- | :------------------ | :------------------------------------------------------------------ |
| `enable`       | `boolean` | `true`             | Enables the XEMS engine and internal session middleware.            |
| `sandbox`      | `string`  | `"xems.session"`    | Default sandbox (namespace) for sessions created via `xLink`.       |
| `ttl`          | `string`  | `"15m"`             | Session lifetime (e.g., `"1h"`, `"30m"`).                           |
| `autoRotation` | `boolean` | `true`              | Enables automatic token rotation on every request.                  |
| `gracePeriod`  | `number`  | `1000`              | Milliseconds the old token remains valid after rotation.            |
| `cookieName`   | `string`  | `"xems_token"`      | Name of the `HttpOnly` cookie used for session storage.             |
| `headerName`   | `string`  | `"x-xypriss-token"` | Name of the header used for token transport in non-cookie contexts. |

## Persistence (The Vault)

Persistence allows XEMS to save sessions to an encrypted file, surviving server restarts.

| Parameter | Type      | Required | Description                                                              |
| :-------- | :-------- | :------- | :----------------------------------------------------------------------- |
| `enabled` | `boolean` | No       | Enables on-disk encryption.                                              |
| `path`    | `string`  | Yes\*    | Real path to the encrypted vault file (e.g., `"./.private/vault.xems"`). |
| `secret`  | `string`  | Yes\*    | 32-byte master key for AES-GCM encryption.                               |

> [!WARNING]
> The `secret` must be exactly 32 bytes (256 bits). If the secret is lost, all data in the vault becomes permanently unrecoverable. Hardware-bound entropy means the vault cannot be moved across machines.

## Resource Limits

| Parameter     | Type     | Default | Description                                                  |
| :------------ | :------- | :------ | :----------------------------------------------------------- |
| `cacheSize`   | `number` | `1024`  | Maximum number of records per sandbox kept in active memory. |
| `maxBodySize` | `number` | `10MB`  | Maximum size of session data payload.                        |

## Multi-Server Integration

When using the `multiServer` orchestrator, XEMS configuration is inherited by all server instances unless overridden.

> [!IMPORTANT]
> To avoid storage collisions, each server instance should either use a unique persistence `path` or ensure the path is managed by the same root application in a coordinated deployment.

---

_Copyright © 2026 Nehonix Team. All rights reserved._

