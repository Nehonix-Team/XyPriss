# XHSC Versioning & Naming Convention

This document formalizes the structure and logic of the **XyPriss Hyper-System Core (XHSC)** versioning system.

## Core Principle: The 8-Character Payload

The XHSC versioning architecture is built on a **12-character total length** (4-character identifier + 8-character logical payload).

## Formal Structure: `XHSC[MMDD][YY][GX]`

| Segment  | Length | Meaning                                              |
| :------- | :----- | :--------------------------------------------------- |
| **XHSC** | 4      | **X**yPriss **H**yper-**S**ystem **C**ore Identifier |
| **MMDD** | 4      | Build Timestamp (Month and Day)                      |
| **YY**   | 2      | Year of Deployment (e.g., 2026 -> 26)                |
| **GX**   | 2      | Architectural Generation (e.g., G3)                  |

---

## Zero-Suppression Logic

To optimize visual density while maintaining logical integrity, **leading zeros in the MMDD segment are suppressed during written representation**.

### Decoding Example: `XHSC4626G3`

To decode the version string, the payload must be expanded back to its 8-character logical state:

1. **Identifier**: `XHSC`
2. **Written Payload**: `4626G3` (6 characters)
3. **Logical Expansion**: `0406` (Date) + `26` (Year) + `G3` (Gen) = `040626G3` (8 characters)
4. **Total Context**: **April 6, 2026 | Generation 3 Architecture**

---

## Architectural Generations (GX)

The **G** index represents the structural evolution of the XyPriss engine.

| Gen    | Code Name      | Technology    | Strategic Role                                    |
| :----- | :------------- | :------------ | :------------------------------------------------ |
| **G1** | _Legacy_       | Node.js (JS)  | Initial monolithic JavaScript core.               |
| **G2** | _Bridge_       | Rust Native   | Hybrid architecture with native utility binaries. |
| **G3** | _Native-First_ | **Go (XHSC)** | Full native core delegation (Go-First Engine).    |

---

## Symbolic Meaning of "G3"

In the XyPriss philosophy, **G3** signifies the "Age of Rationality," representing the synergy between:

- **G**o-Native: High-concurrency performance.
- **G**uardian: Advanced security and binary validation.
- **G**lobal: Distributed multi-server scalability.

As the creator defines the meaning of their work, **G3** stands as the definitive benchmark for the next era of backend engineering.

