import { describe, it, expect } from "bun:test";
import { Configs } from "../src/ConfigurationManager";

describe("ConfigurationManager Hardening (XSA-CFG-001 & XSA-XESS-029)", () => {
    it("should allow host project to access and set configurations", () => {
        Configs.reset();
        expect(Configs.isInitialized()).toBe(false);

        Configs.set({
            server: {
                port: 9999,
            } as any,
        });

        expect(Configs.isInitialized()).toBe(true);
        expect(Configs.get("server")?.port).toBe(9999);
        expect(Configs.has("server")).toBe(true);
    });

    it("should prevent heap inspection via private slots", () => {
        // Native ES private slots are not accessible via standard property access
        expect((Configs as any).instance).toBeUndefined();
        expect((Configs as any)._config).toBeUndefined();
        expect((Configs as any)["#config"]).toBeUndefined();
        expect((Configs as any)["#instance"]).toBeUndefined();
    });

    it("should protect globalThis.__cfg__ with impermeable proxy", () => {
        const globalCfg = (globalThis as any).__cfg__;
        expect(globalCfg).toBeDefined();

        // Host can access methods
        expect(typeof globalCfg.get).toBe("function");

        // Disallow tampering on the proxy itself
        try {
            globalCfg.tampered = true;
        } catch {
            // TypeError in strict mode or silently fails
        }
        expect(globalCfg.tampered).toBeUndefined();
    });
});
