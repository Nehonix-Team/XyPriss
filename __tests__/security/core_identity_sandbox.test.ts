/**
 * XyPriss Security Regression Suite — XSA-CORE-001 to XSA-CORE-006
 *
 * Empirically verifies framework identity checks (isEngineCorePath, isCoreFrameworkPath)
 * and caller sandbox boundaries (ProjectDiscovery) against spoofing, path traversal,
 * nested node_modules escalation, and dynamic root tampering.
 */
import {
    ENGINE_CORE_DIR,
    isEngineCorePath,
    isCoreFrameworkPath,
} from "../../src/utils/CorePathCheck";
import {
    setRootInterceptor,
    getPrimaryProjectRoot,
    identifyProjectRoot,
} from "../../src/utils/ProjectDiscovery";

let passed = 0;
let failed = 0;

function check(id: string, description: string, condition: boolean) {
    if (condition) {
        console.log(`  ✅ PASS [${id}]: ${description}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL [${id}]: ${description}`);
        failed++;
    }
}

console.log("\n🔒 Running XSA-CORE-001..006 Sandbox & Identity Security Tests...\n");

// ---------------------------------------------------------------------------
// XSA-CORE-001: Substring spoofing in isEngineCorePath / isCoreFrameworkPath
// ---------------------------------------------------------------------------
check(
    "XSA-CORE-001a",
    "External path containing '/XyPriss/src/' is NOT treated as engine core",
    isEngineCorePath("/tmp/untrusted/XyPriss/src/fake.js") === false,
);
check(
    "XSA-CORE-001b",
    "External path containing '/XyPriss/dist/' is NOT treated as engine core",
    isEngineCorePath("/tmp/untrusted/XyPriss/dist/fake.js") === false,
);
check(
    "XSA-CORE-001c",
    "Third-party node_modules path containing '/XyPriss/mods/' is NOT treated as core framework",
    isCoreFrameworkPath("/app/node_modules/evil-pkg/XyPriss/mods/index.js") === false,
);
check(
    "XSA-CORE-001d",
    "Arbitrary path containing '/XyPriss/mods/' is NOT treated as core framework",
    isCoreFrameworkPath("/tmp/XyPriss/mods/spoof.js") === false,
);

// ---------------------------------------------------------------------------
// XSA-CORE-002: Over-broad ENGINE_CORE_DIR (nested node_modules & sibling mods)
// ---------------------------------------------------------------------------
check(
    "XSA-CORE-002a",
    "Nested dependency inside ENGINE_CORE_DIR/node_modules/ is NOT treated as engine core",
    isEngineCorePath(`${ENGINE_CORE_DIR}node_modules/malicious-dep/index.js`) === false,
);
check(
    "XSA-CORE-002b",
    "Sibling plugin directory ENGINE_CORE_DIR/mods/xyphra/ is NOT treated as engine core",
    isEngineCorePath(`${ENGINE_CORE_DIR}mods/xyphra/src/index.ts`) === false,
);
check(
    "XSA-CORE-002c",
    "Sibling simulation/app directory ENGINE_CORE_DIR/simulations/XCIS/ is NOT treated as engine core",
    isEngineCorePath(`${ENGINE_CORE_DIR}simulations/XCIS/src/server.ts`) === false,
);

// ---------------------------------------------------------------------------
// XSA-CORE-003: Path traversal ('..') normalization before prefix check
// ---------------------------------------------------------------------------
check(
    "XSA-CORE-003a",
    "Traversal escaping ENGINE_CORE_DIR/src/ via '../mods/' is rejected by isEngineCorePath",
    isEngineCorePath(`${ENGINE_CORE_DIR}src/../mods/xyphra/index.js`) === false,
);
check(
    "XSA-CORE-003b",
    "Traversal escaping ENGINE_CORE_DIR/dist/ via '../../evil/' is rejected by isCoreFrameworkPath",
    isCoreFrameworkPath(`${ENGINE_CORE_DIR}dist/../../evil/index.js`) === false,
);
check(
    "XSA-CORE-003c",
    "Windows backslash traversal escaping ENGINE_CORE_DIR\\src\\..\\node_modules\\ is rejected",
    isEngineCorePath(`${ENGINE_CORE_DIR}src\\..\\node_modules\\evil\\index.js`) === false,
);

// ---------------------------------------------------------------------------
// XSA-CORE-004: setRootInterceptor() must reject non-engine callers
// ---------------------------------------------------------------------------
let interceptorRejected = false;
try {
    setRootInterceptor(() => "/tmp/hijacked-root");
} catch {
    interceptorRejected = true;
}
check(
    "XSA-CORE-004",
    "setRootInterceptor() rejects unauthorized external caller",
    interceptorRejected === true,
);

// ---------------------------------------------------------------------------
// XSA-CORE-005: Primary project root must remain anchored even if process.chdir() runs
// ---------------------------------------------------------------------------
const origCwd = process.cwd();
const origEnvRoot = process.env.XYPRISS_PROJECT_ROOT;
const initialPrimaryRoot = getPrimaryProjectRoot();
let chdirAnchored = false;
try {
    delete process.env.XYPRISS_PROJECT_ROOT;
    process.chdir("/tmp");
    const afterChdirRoot = getPrimaryProjectRoot();
    chdirAnchored = afterChdirRoot === initialPrimaryRoot;
} finally {
    process.chdir(origCwd);
    if (origEnvRoot !== undefined) {
        process.env.XYPRISS_PROJECT_ROOT = origEnvRoot;
    }
}
check(
    "XSA-CORE-005",
    "getPrimaryProjectRoot() stays anchored at bootstrap root after process.chdir('/tmp')",
    chdirAnchored === true,
);

// ---------------------------------------------------------------------------
// Legitimate Positive Controls (No Regressions)
// ---------------------------------------------------------------------------
check(
    "POS-001",
    "Genuine engine core file in ENGINE_CORE_DIR/src/ IS recognized as engine core",
    isEngineCorePath(`${ENGINE_CORE_DIR}src/xhsc/EnvApi.ts`) === true,
);
check(
    "POS-002",
    "Genuine engine core file in ENGINE_CORE_DIR/dist/ IS recognized as engine core",
    isEngineCorePath(`${ENGINE_CORE_DIR}dist/xhsc/EnvApi.js`) === true,
);
check(
    "POS-003",
    "Genuine engine core file IS recognized as core framework",
    isCoreFrameworkPath(`${ENGINE_CORE_DIR}src/xhsc/System.ts`) === true,
);
check(
    "POS-004",
    "Monorepo plugin file under mods/xyphra resolves to its own sandbox root (not host)",
    identifyProjectRoot(`${ENGINE_CORE_DIR}mods/xyphra/src/index.ts`) ===
        `${ENGINE_CORE_DIR}mods/xyphra`,
);

console.log(`\n📊 Summary: ${passed} passed, ${failed} failed.\n`);
process.exit(failed > 0 ? 1 : 0);
