# XyPriss Plugin Signatures (Zero-Trust)

XyPriss implements a cryptographic signature verification system (Ed25519) to ensure the authenticity and integrity of third-party plugins, especially those with high privileges.

## Configuration

You can configure signature verification via `ServerOptions`:

```typescript
const server = createServer({
    plugins: {
        // Enables signature verification
        verifySignature: true,

        // Makes verification fatal (blocks loading on failure)
        strict: true,

        register: [myPlugin],
    },
});
```

### Options

| Option            | Type      | Description                                                                                     |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `verifySignature` | `boolean` | Enables verification. If `false`, no check is performed.                                        |
| `strict`          | `boolean` | If `true`, signature failure prevents the plugin from loading. If `false`, a warning is logged. |

## Why Sign?

Plugins have privileged access to the XHSC core. Without signatures, an attacker could:

- Replace a legitimate plugin with a malicious version.
- Inject a "ghost" plugin into a monitored directory.

Signatures guarantee that the plugin:

1. Comes from a trusted author.
2. Has not been moved from its original directory (`root` pinning).

## Security FAQ

### "What if someone sees the public key in the code?"

That's perfectly fine. A **public** key is designed to be public. It is used only to **verify** that a signature is valid. Only the **private key** (kept secret by Nehonix or the author) can generate a valid signature.

### "What if someone modifies the public key in my source code?"

This is a critical risk. If an attacker has write access to your source code, they can replace the framework's public key with their own. At that point, the entire system is compromised. Maintaining the security of your source files is paramount.

## Key Management & Private Key Usage

### How to get a private key?

In a Zero-Trust ecosystem, the **Master Private Key** is held by Nehonix to sign "Official" and "Certified" plugins.

### For Internal/Custom Plugins:

1.  **Certification**: Submit your plugin for certification, and it will be signed with the Framework Root Key.
2.  **Custom Trust Anchors**: Future versions of XyPriss will allow you to provide your own public key in the configuration, allowing you to sign your internal plugins with your own private key.

### Sign-Time Integrity

The signature is bound to the plugin's `name`, `version`, and `root` path. This prevents "Signature Replay" attacks where a valid signature for one plugin is reused for another.

