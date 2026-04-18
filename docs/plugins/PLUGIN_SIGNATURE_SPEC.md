# Plugin Signature Specification (Zero-Trust G3)

The XyPriss Plugin Signature System is a core component of the G3 Zero-Trust architecture. It ensures the integrity, authenticity, and non-repudiation of all third-party extensions within the XyPriss ecosystem. Unlike traditional systems that rely on a central authority, the XyPriss model is fully decentralized, allowing for secure plugin distribution and verified trust without external dependencies.

---

## 1. Security Logic

The system is built on a "Verify-Always" principle, operating at three distinct levels of the application lifecycle:

1.  **Installation Proof**: XFPM verifies the author's cryptographic signature during the initial download.
2.  **Pinned Identity (TOFU)**: During the first installation, the author's public key is pinned in the project configuration. Any subsequent version must be signed by the same key.
3.  **Startup Validation (Deep Audit)**: The XHSC engine re-calculates the cryptographic hash of every plugin file during every server initialization, blocking any execution if tampering resides.

---

## 2. Manifest Architecture (`xypriss.plugin.sig`)

Every secure plugin contains a `xypriss.plugin.sig` manifest. This is a signed JSON block that captures the state of the plugin assets at the time of publication.

### Specification Fields

| Field               | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `name`              | The canonical name of the plugin.                                         |
| `version`           | The specific version of this release.                                     |
| `content_hash`      | A recursive SHA-256 fingerprint of all included source and asset files.   |
| `author_key`        | The Ed25519 public key of the publisher.                                  |
| `min_version`       | The minimum XyPriss framework version required for execution.             |
| `prev_version_hash` | A link to the previous signature, forming a tamper-proof version history. |
| `signature`         | An Ed25519 cryptographic signature of the entire manifest block.          |

---

## 3. Trust Store Configuration (Unified Model)

Trusted author identities are managed within each plugin's dedicated configuration block inside the `$internal` object. This architecture eliminates redundancy by consolidating security metadata with operational permissions and workspaces.

```jsonc
{
    "$internal": {
        "xypriss-plugin-name": {
            "signature": {
                "author_key": "ed25519:AuthorPublicKeyFingerprint",
            },
        },
    },
}
```

If XHSC detects a signed plugin, it validates the embedded author key against the pinned `author_key` in the configuration. If they do not match, or if the key is missing from a previously trusted plugin, execution is automatically blocked.

---

## 4. Revocation Strategy

In the event of a security breach or a compromised developer key, XyPriss implements a decentralized revocation protocol:

- **Blocklist Manifests**: Authors can embed revocation lists in subsequent signed versions.
- **Runtime Kill-Switch**: The XHSC Deep Audit engine parses the `xfpm.revoked` metadata in `package.json`. If a local plugin is marked as revoked, the engine issues a `FATAL` halt, preventing the server from starting with unsafe code.

---

## 5. Security Guarantees

- **Code Integrity**: Protects against post-installation file modifications (backdoors, loggers).
- **Author Non-Repudiation**: Guarantees that the code originated from the authorized Developer ID.
- **Downgrade Protection**: Prevents attackers from forcing the installation of older, vulnerable versions via `min_version` enforcement and version chaining.
- **Complete Decoupling**: The system remains functional even without internet access or Nehonix infrastructure connectivity.

---

**Standard: XyPriss-G3-SECURE**

