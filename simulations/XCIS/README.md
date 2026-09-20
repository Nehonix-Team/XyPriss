# XyPriss Core Integration & Security Simulation Server (XCIS)

> **Internal R&D and Continuous Integration Testbed**  
> *Engineered by Nehonix Team*

---

## 1. Overview

**XCIS** (*XyPriss Core Integration Simulation*) is the internal validation and benchmarking harness used by the core XyPriss engineering team. It simulates real-world high-concurrency microservices, multi-server routing architectures, and strict security sandboxing.

### Scope & Primary Roles
* **Kernel-Level Confinement Verification**: Validates the **libXESS v3.0** Bipolar Zero-Trust Shield (kernel namespace isolation, Canary Tarpit honeypot decoys, and RAM-only secret distribution via IPC).
* **Multi-Server Orchestration (XMS)**: Tests concurrent multi-tenant routing, workers delegation, session sandboxes, and rate-limiting shields (XTRS).
* **HTTP Engine Benchmark (XHSC)**: Validates performance, low-latency stream handling, and IPC bridge reliability between Bun/Node.js runtimes and the native Go core.
* **Security & Penetration Testing**: Serves as a red-team testing lab to simulate directory traversal attacks, environment variable exfiltration (`getHostEnv`), and unauthorized memory inspection.

---

## 2. Release & Distribution Policy

> [!IMPORTANT]
> **Strictly Excluded from Production Releases:**  
> This directory (`simulations/XCIS/`) and its contents are internal development artifacts. They are automatically excluded from production builds, npm distribution tarballs, and official framework releases.

---

## 3. Logging & Visual Telemetry Policy

Throughout the test scripts in this environment (e.g. `src/server.ts`), you may notice the deliberate use of visual markers and emojis in stdout logs.

* **Purpose**: Allows engineers and CI runners to quickly distinguish automated simulation checkpoints, penetration test probes, and server lifecycle states during high-speed real-time logs.
* **Production Contrast**: Unlike this simulation harness, all core XyPriss runtime logs remain strictly sober, structured, and free of extraneous emojis.

---

## 4. Running the Simulation

You can launch the XCIS simulation using either direct `xfpm` or the `FileOnix` native watcher:

```bash
# Direct run with libXESS confinement shield
xfpm run simulations/XCIS/src/server.ts

# Live-reload development mode via FileOnix
fileonix -l xess --script simulations/XCIS/src/server.ts
```

---

© 2026 **Nehonix Team**. All rights reserved. Internal Use Only.
