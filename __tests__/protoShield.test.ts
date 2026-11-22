import { describe, it, expect } from "bun:test";
import { ProtoShield } from "../src/server/utils/ProtoShield";

describe("ProtoShield Configuration Validation (Boot-Time)", () => {
    it("should accept valid configuration with default values", () => {
        const config = ProtoShield.validateConfig({});
        expect(config.enabled).toBe(true);
        expect(config.mode).toBe("block");
        expect(config.neutralizeProto).toBe(true);
        expect(config.freezePrototypes).toBe(false);
        expect(config.allowedProperties).toEqual([]);
    });

    it("should accept full valid custom configuration", () => {
        const config = ProtoShield.validateConfig({
            enabled: true,
            mode: "warn",
            neutralizeProto: false,
            freezePrototypes: true,
            allowedProperties: ["safePolyfill", "customHelper"],
        });
        expect(config.mode).toBe("warn");
        expect(config.neutralizeProto).toBe(false);
        expect(config.freezePrototypes).toBe(true);
        expect(config.allowedProperties).toEqual(["safePolyfill", "customHelper"]);
    });

    it("should reject non-object configuration", () => {
        expect(() => ProtoShield.validateConfig("invalid" as any)).toThrow(
            "[XyPriss Validation Error] 'protoShield' must be a valid JSON object",
        );
        expect(() => ProtoShield.validateConfig(null as any)).toThrow(
            "[XyPriss Validation Error] 'protoShield' must be a valid JSON object",
        );
        expect(() => ProtoShield.validateConfig([] as any)).toThrow(
            "[XyPriss Validation Error] 'protoShield' must be a valid JSON object",
        );
    });

    it("should reject unknown configuration keys (typo detection)", () => {
        expect(() =>
            ProtoShield.validateConfig({
                enabled: true,
                invalidKey: "foo",
            } as any),
        ).toThrow("Unknown property 'protoShield.invalidKey'");
    });

    it("should reject invalid 'mode' values", () => {
        expect(() =>
            ProtoShield.validateConfig({
                mode: "unsupported_mode" as any,
            }),
        ).toThrow(
            "Invalid 'protoShield.mode': \"unsupported_mode\". Accepted values are: 'block', 'warn', 'freeze'.",
        );
    });

    it("should reject non-boolean flags", () => {
        expect(() =>
            ProtoShield.validateConfig({
                enabled: "true" as any,
            }),
        ).toThrow("'protoShield.enabled' must be a boolean");

        expect(() =>
            ProtoShield.validateConfig({
                neutralizeProto: 1 as any,
            }),
        ).toThrow("'protoShield.neutralizeProto' must be a boolean");

        expect(() =>
            ProtoShield.validateConfig({
                freezePrototypes: "yes" as any,
            }),
        ).toThrow("'protoShield.freezePrototypes' must be a boolean");
    });

    it("should reject invalid allowedProperties items", () => {
        expect(() =>
            ProtoShield.validateConfig({
                allowedProperties: "not-an-array" as any,
            }),
        ).toThrow("'protoShield.allowedProperties' must be an array of strings");

        expect(() =>
            ProtoShield.validateConfig({
                allowedProperties: ["valid", 123 as any],
            }),
        ).toThrow("'protoShield.allowedProperties[1]' must be a non-empty string");
    });
});
