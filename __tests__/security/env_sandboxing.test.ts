import { __sys__ } from "../../src/xhsc";
import { XY_ENV_INTERNAL_GET_FOR_ROOT, XY_ENV_CONFIGURE_SHIELD } from "../../src/xhsc/api/env/env";

async function runTests() {
    console.log("🔒 Starting __sys__.__env__ Security & Sandboxing Tests...\n");

    let failed = 0;
    function assert(condition: boolean, msg: string) {
        if (condition) {
            console.log(`  ✅ PASS: ${msg}`);
        } else {
            console.error(`  ❌ FAIL: ${msg}`);
            failed++;
        }
    }

    // 1. Verify getForRoot is removed from public API
    assert(
        ( __sys__.__env__ as any ).getForRoot === undefined,
        "__sys__.__env__.getForRoot is strictly undefined (public bypass eliminated)"
    );

    // 2. Verify configureShield is removed from public API
    assert(
        ( __sys__.__env__ as any ).configureShield === undefined,
        "__sys__.__env__.configureShield is strictly undefined (public whitelist bypass eliminated)"
    );

    // 3. Verify internal _ prefixed properties are shielded from external read
    assert(
        ( __sys__ as any )._primaryRoot === undefined,
        "__sys__._primaryRoot is masked/undefined through the SecurityShield"
    );
    assert(
        ( __sys__ as any )._internalRoot === undefined,
        "__sys__._internalRoot is masked/undefined through the SecurityShield"
    );
    assert(
        ( __sys__ as any )._pluginMap === undefined,
        "__sys__._pluginMap is masked/undefined through the SecurityShield"
    );

    // 4. Verify CRUD operations function normally
    __sys__.__env__.set("TEST_SANDBOX_KEY", "sandbox_value_123");
    assert(
        __sys__.__env__.get("TEST_SANDBOX_KEY") === "sandbox_value_123",
        "__sys__.__env__.get() retrieves caller-scoped value"
    );
    assert(
        __sys__.__env__.has("TEST_SANDBOX_KEY") === true,
        "__sys__.__env__.has() detects caller-scoped key"
    );
    assert(
        __sys__.__env__.all()?.["TEST_SANDBOX_KEY"] === "sandbox_value_123",
        "__sys__.__env__.all() includes caller-scoped key"
    );

    __sys__.__env__.delete("TEST_SANDBOX_KEY");
    assert(
        __sys__.__env__.has("TEST_SANDBOX_KEY") === false,
        "__sys__.__env__.delete() successfully removes variable"
    );
    assert(
        __sys__.__env__.get("TEST_SANDBOX_KEY") === undefined,
        "__sys__.__env__.get() returns undefined after deletion"
    );

    // 5. Verify internal framework symbols work
    const root = process.cwd();
    const internalVal = ( __sys__.__env__ as any )[XY_ENV_INTERNAL_GET_FOR_ROOT]?.("__root__", root);
    assert(
        internalVal === root,
        "Internal symbol XY_ENV_INTERNAL_GET_FOR_ROOT works for internal engine operations"
    );

    // 6. Verify mode helpers work
    assert(
        typeof __sys__.__env__.isDevelopment() === "boolean",
        "__sys__.__env__.isDevelopment() is accessible"
    );
    assert(
        typeof __sys__.__env__.isProduction() === "boolean",
        "__sys__.__env__.isProduction() is accessible"
    );

    console.log(`\nTests completed with ${failed} failure(s).`);
    if (failed > 0) {
        process.exit(1);
    }
    process.exit(0);
}

runTests().catch((err) => {
    console.error("Unexpected test error:", err);
    process.exit(1);
});
