import { createServer, XyPrissSys, __sys__ } from "../src";
import { testSConfigs2 } from "./configs";
import router from "./router";
import { logger } from "./testPlugin_Logger";

// Créez d'abord la configuration

// Gelez toute la configuration avant de la passer
const app = createServer({
    security: {
        requestSignature: {
            headerName: "X-My-Custom-Sig", // Custom header for testing
            errorMessage:
                "Unauthorized. A valid X-My-Custom-Sig header is required.",
            statusCode: 401,
            timingSafeComparison: true,
            rejectSuspiciousPatterns: true,
            minSecretLength: 32,
            secret: "17901b292973efd9e918951b92eefb3289522078bd439c64da24a96133d3981d",
        },
    },
    responseManipulation: {
        enabled: true,
        rules: [
            { field: "user.password", replacement: "[MASKED]" },
            { field: "api_key", preserve: 4 },
            { field: /.*_id$/, replacement: "[REG-ID]" },
            {
                valuePattern: /prisma\./i,
                replacement:
                    "Une erreur interne s'est produite. Veuillez contacter le support.",
            },
        ],
        maxDepth: 5,
    },
    // server: {
    //     xhsc: true
    // }
});

app.get("/test", (req, res) => {
    res.json({ message: "Hello World!" });
});

app.get("/test-response", (req, res) => {
    res.json({
        user: {
            username: "admin",
            password: "supersecretpassword123",
            internal_id: "123456",
        },
        api_key: "ak-test-1234567890abcdef",
        session_id: "sess-999",
        public_info: "this should be visible",
        metadata: {
            deep: {
                deeper: {
                    deepest: {
                        too_deep: {
                            hidden: "this should be cut off by depth",
                        },
                    },
                },
            },
        },
    });
});

app.get("/sys-info", (req, res) => {
    res.json({
        memory: __sys__.$memory(),
    });
});

app.get("/test-error", (req, res) => {
    res.json({
        status: "error",
        message:
            "PrismaClientKnownRequestError: Invalid `prisma.product.findMany()` call.",
        meta: {
            error_code: "P2002",
            details: "Standard error message that should stay.",
        },
    });
});

app.start();

