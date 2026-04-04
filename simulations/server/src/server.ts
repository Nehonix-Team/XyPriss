import { createServer } from "xypriss";
import { SwaggerPlugin } from "xypriss-swagger";

const server = createServer({
    server: {
        port: 3728,
        trustProxy: ["loopback", "192.168.1.0/24"],
    },
    pluginPermissions: [
        {
            name: "xypriss-swagger",
            allowedHooks: ["PLG.OPS.AUXILIARY_SERVER"],
        },
    ],
    plugins: {
        register: [
            SwaggerPlugin({
                port: 9282,
            }),
        ],
    },
});

console.log("project sys root: ", __sys__.__root__);

// ─────────────────────────────────────────────
// Route de base — déjà existante
// ─────────────────────────────────────────────
server.get("/ip", (req, res) => {
    res.json({
        ip: req.ip,
        ips: req.ips,
        protocol: req.protocol,
        hostname: req.hostname,
    });
});

// ─────────────────────────────────────────────
// TEST 1 — Vérification complète du trustProxy
// Teste si req.ip est correctement résolu via X-Forwarded-For
// Usage: GET /test/trust-proxy
//   avec header: X-Forwarded-For: 192.168.1.50
// ─────────────────────────────────────────────
server.get("/test/trust-proxy", (req, res) => {
    const rawForwardedFor = req.headers["x-forwarded-for"];
    const resolvedIp = req.ip;
    const ipChain = req.ips;

    console.log("rawForwardedFor: ", rawForwardedFor);
    console.log("resolvedIp: ", resolvedIp);
    console.log("ipChain: ", ipChain);

    const isTrusted = ipChain.length > 1;

    res.json({
        status: isTrusted ? "TRUSTED_PROXY_ACTIVE" : "NO_PROXY_DETECTED",
        resolved_ip: resolvedIp,
        ip_chain: ipChain,
        raw_x_forwarded_for: rawForwardedFor ?? null,
        socket_remote_address: req.socket?.remoteAddress ?? null,
        note: isTrusted
            ? "Le proxy est reconnu — req.ip pointe vers le client réel"
            : "Aucune chaîne proxy détectée — req.ip est l'adresse directe",
    });
});

// ─────────────────────────────────────────────
// TEST 2 — Simulation de plusieurs proxies en chaîne
// Usage: GET /test/proxy-chain
//   avec header: X-Forwarded-For: 10.0.0.1, 192.168.1.1, 203.0.113.5
// ─────────────────────────────────────────────
server.get("/test/proxy-chain", (req, res) => {
    const ipChain = req.ips;
    const resolvedIp = req.ip;

    console.log("rawForwardedFor: ", req.headers["x-forwarded-for"]);
    console.log("resolvedIp: ", resolvedIp);
    console.log("ipChain: ", ipChain);

    res.json({
        status: "PROXY_CHAIN_REPORT",
        resolved_client_ip: resolvedIp,
        full_chain: ipChain,
        chain_length: ipChain.length,
        hops: ipChain.map((ip: string, index: number) => ({
            hop: index + 1,
            ip,
            label:
                index === 0
                    ? "client_origin"
                    : index === ipChain.length - 1
                      ? "last_proxy"
                      : "intermediate_proxy",
        })),
    });
});

// ─────────────────────────────────────────────
// TEST 3 — Vérification du protocole (HTTP vs HTTPS via proxy)
// Usage: GET /test/protocol
//   avec header: X-Forwarded-Proto: https
// ─────────────────────────────────────────────
server.get("/test/protocol", (req, res) => {
    console.log("rawForwardedProto: ", req.headers["x-forwarded-proto"]);
    console.log("protocol: ", req.protocol);
    console.log("is_secure: ", req.protocol === "https");
    res.json({
        status: "PROTOCOL_CHECK",
        protocol: req.protocol,
        is_secure: req.protocol === "https",
        x_forwarded_proto: req.headers["x-forwarded-proto"] ?? null,
        note:
            req.protocol === "https"
                ? "Protocole HTTPS détecté via X-Forwarded-Proto (proxy de confiance)"
                : "Protocole HTTP — pas de header X-Forwarded-Proto ou proxy non fiable",
    });
});

// ─────────────────────────────────────────────
// TEST 4 — Résumé global trustProxy (dashboard de test)
// Usage: GET /test/summary
// ─────────────────────────────────────────────
server.get("/test/summary", (req, res) => {
    const ipChain = req.ips;

    console.log("rawForwardedFor: ", req.headers["x-forwarded-for"]);
    console.log("resolvedIp: ", req.ip);
    console.log("ipChain: ", ipChain);

    res.json({
        trustProxy_config: ["loopback", "192.168.1.0/24"],
        resolved_ip: req.ip,
        ip_chain: ipChain,
        protocol: req.protocol,
        hostname: req.hostname,
        headers: {
            x_forwarded_for: req.headers["x-forwarded-for"] ?? null,
            x_forwarded_proto: req.headers["x-forwarded-proto"] ?? null,
            x_forwarded_host: req.headers["x-forwarded-host"] ?? null,
        },
        diagnostics: {
            proxy_trusted: ipChain.length > 1,
            real_ip_resolved: ipChain.length > 0 ? ipChain[0] : req.ip,
            direct_connection: ipChain.length <= 1,
        },
    });
});


server.get("/test/manual-ip", (req, res) => {
    const xff = req.headers["x-forwarded-for"];
    const manualChain = xff
        ? (xff as string).split(",").map((s) => s.trim())
        : [];
    const manualClientIp = manualChain[0] ?? req.ip;

    console.log("xff_raw: ", xff);
    console.log("manual_chain: ", manualChain);
    console.log("manual_client_ip: ", manualClientIp);
    console.log("framework_ip: ", req.ip);
    console.log("framework_ips: ", req.ips);

    res.json({
        xff_raw: xff ?? null,
        manual_chain: manualChain,
        manual_client_ip: manualClientIp,
        framework_ip: req.ip,
        framework_ips: req.ips,
        verdict:
            manualClientIp !== req.ip
                ? "⚠️ trustProxy non appliqué par XyPriss — req.ip != IP réelle"
                : "✅ req.ip correct",
    });
});
server.start();

