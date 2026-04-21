import { Router } from "xypriss";

export const trustProxyRouter = Router();

// Base group
trustProxyRouter.get("/ip", (req, res) => {
    res.json({
        ip: req.ip,
        ips: req.ips,
        protocol: req.protocol,
        hostname: req.hostname,
    });
});

/**
 * Routing V2: Group with meta grouping
 */
trustProxyRouter.group(
    {
        prefix: "/test",
        meta: { tags: ["network-test"] },
    },
    (group) => {
        group.get("/trust-proxy", (req, res) => {
            const rawForwardedFor = req.headers["x-forwarded-for"];
            const resolvedIp = req.ip;
            const ipChain = req.ips;

            const isTrusted = ipChain.length > 1;

            res.json({
                status: isTrusted
                    ? "TRUSTED_PROXY_ACTIVE"
                    : "NO_PROXY_DETECTED",
                resolved_ip: resolvedIp,
                ip_chain: ipChain,
                raw_x_forwarded_for: rawForwardedFor ?? null,
                socket_remote_address: req.socket?.remoteAddress ?? null,
                note: isTrusted
                    ? "Le proxy est reconnu — req.ip pointe vers le client réel"
                    : "Aucune chaîne proxy détectée — req.ip est l'adresse directe",
            });
        });

        group.get("/proxy-chain", (req, res) => {
            const ipChain = req.ips;
            const resolvedIp = req.ip;

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

        group.get("/protocol", (req, res) => {
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

        group.get("/summary", (req, res) => {
            const ipChain = req.ips;

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

        group.get("/manual-ip", (req, res) => {
            const xff = req.headers["x-forwarded-for"];
            const manualChain = xff
                ? (xff as string).split(",").map((s) => s.trim())
                : [];
            const manualClientIp = manualChain[0] ?? req.ip;

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
    },
);

