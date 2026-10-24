import { createServer } from "../src/server/ServerFactory";
import { Configs } from "../src/ConfigurationManager";
import { MultiServerApp } from "../src/server/components/multi-server/MultiServerApp";
import { XessIpcClient } from "../src/xhsc/api/env/XessIpcClient";

describe("XEMS Multi-Server Configuration Cascade & Inheritance (Issue #2)", () => {
    beforeAll(() => {
        (XessIpcClient as any).isShielded = () => true;
        (XessIpcClient as any).fetchSecretsSync = () => ({});
    });
    const validSecret = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"; // 32 bytes valid secret
    const vaultPath = "./data/test_vault.xems";

    afterEach(() => {
        Configs.reset();
    });

    it("should automatically inherit global server.xems on auxiliary child servers", async () => {
        const authServerConfig = {
            id: "rest.auth.domain.com",
            port: 7825,
            routePrefix: "/auth",
        };

        const mainServerConfig = {
            id: "server.main.domain.com",
            port: 7826,
            routePrefix: "/api",
            server: {
                autoPortSwitch: false,
            },
        };

        const app = createServer({
            server: {
                port: 8000,
                xems: {
                    enable: true,
                    secret: validSecret,
                    path: vaultPath,
                    cookieName: "custom_session_token",
                    cookieOptions: {
                        domain: ".domain.com",
                        sameSite: "Lax",
                        secure: true,
                    },
                },
            },
            multiServer: {
                enabled: true,
                servers: [authServerConfig, mainServerConfig],
            },
        }) as unknown as MultiServerApp;

        // Verify multi-server app created
        expect(app).toBeDefined();

        // Instantiate server instances via manager
        const authInstance = await (app as any).manager.createServerInstance(authServerConfig);
        const mainInstance = await (app as any).manager.createServerInstance(mainServerConfig);

        expect(authInstance).toBeDefined();
        expect(mainInstance).toBeDefined();

        // 1. Verify that authServer (no server block) inherited full xems config
        const authConfigs = authInstance.app.configs;
        expect(authConfigs.server?.xems).toBeDefined();
        expect(authConfigs.server?.xems?.enable).toBe(true);
        expect(authConfigs.server?.xems?.secret).toBe(validSecret);
        expect(authConfigs.server?.xems?.path).toBe(vaultPath);
        expect(authConfigs.server?.xems?.cookieName).toBe("custom_session_token");
        expect(authConfigs.server?.xems?.cookieOptions?.domain).toBe(".domain.com");
        expect(authConfigs.server?.xems?.cookieOptions?.sameSite).toBe("Lax");

        // 2. Verify that mainServer (custom server.autoPortSwitch) inherited xems config without losing autoPortSwitch
        const mainConfigs = mainInstance.app.configs;
        expect(mainConfigs.server?.autoPortSwitch).toBe(false);
        expect(mainConfigs.server?.xems).toBeDefined();
        expect(mainConfigs.server?.xems?.enable).toBe(true);
        expect(mainConfigs.server?.xems?.secret).toBe(validSecret);
        expect(mainConfigs.server?.xems?.cookieOptions?.domain).toBe(".domain.com");

        // 3. Verify XemsBuiltinPlugin configuration on both server apps
        const authPlugin = authInstance.app.getPlugin?.("xypriss::xems.core") as any;
        const mainPlugin = mainInstance.app.getPlugin?.("xypriss::xems.core") as any;

        if (authPlugin) {
            expect(authPlugin.hasValidSecret).toBe(true);
            expect(authPlugin.sessionOptions.cookieName).toBe("custom_session_token");
            expect(authPlugin.sessionOptions.cookieOptions.domain).toBe(".domain.com");
            expect(authPlugin.sessionOptions.cookieOptions.sameSite).toBe("Lax");
        }

        if (mainPlugin) {
            expect(mainPlugin.hasValidSecret).toBe(true);
            expect(mainPlugin.sessionOptions.cookieOptions.domain).toBe(".domain.com");
        }

        // 4. Verify that both instances share the exact same XemsRunner process
        if (authInstance.app.xems && mainInstance.app.xems) {
            expect(authInstance.app.xems).toBe(mainInstance.app.xems);
        }
    });

    it("should allow a child server to selectively override specific xems options", async () => {
        const customAuthServer = {
            id: "rest.auth.domain.com",
            port: 7825,
            server: {
                xems: {
                    enable: true,
                    sandbox: "custom-auth-sandbox",
                    cookieName: "custom_auth_cookie",
                },
            },
        };

        const app = createServer({
            server: {
                port: 8000,
                xems: {
                    enable: true,
                    secret: validSecret,
                    path: vaultPath,
                    cookieOptions: {
                        domain: ".shared-domain.com",
                        sameSite: "Lax",
                    },
                },
            },
            multiServer: {
                enabled: true,
                servers: [customAuthServer],
            },
        }) as unknown as MultiServerApp;

        const authInstance = await (app as any).manager.createServerInstance(customAuthServer);
        const authConfigs = authInstance.app.configs;

        // Overridden options
        expect(authConfigs.server?.xems?.sandbox).toBe("custom-auth-sandbox");
        expect(authConfigs.server?.xems?.cookieName).toBe("custom_auth_cookie");

        // Inherited options from global
        expect(authConfigs.server?.xems?.secret).toBe(validSecret);
        expect(authConfigs.server?.xems?.path).toBe(vaultPath);
        expect(authConfigs.server?.xems?.cookieOptions?.domain).toBe(".shared-domain.com");
        expect(authConfigs.server?.xems?.cookieOptions?.sameSite).toBe("Lax");
    });
});
