import { createServer, Plugin, XStatic } from "xypriss";
// import { XyphraPlugin } from "xyphra";

const app = createServer({
    security: {
        honeypotTarpit: {
            enabled: false,
        },
    },
    multiServer: {},
    static: {
        dotfiles: "deny",
        // concurrencyPool: ""
    },
    notFound: {},

    plugins: {
        register: [
            // XyphraPlugin({
            //     anonymizeIp: true,
            //     // format: "string",
            //     tokens: {
            //         remote: (req, res) => {
            //             return req.socket.remoteAddress || "";
            //         },
            //     },
            //     immediate: false,
            //     stream: {
            //         write(str: string) {
            //             console.log(str);
            //         },
            //     },
            // }),
        ],
    },
});

// Instantiate the manager with application and system context
const xs = new XStatic(app, __sys__);

// Define a static route
xs.define("/static", "public");

app.get("/ping", (req, res) => {
    res.send("pong");
});

app.get("/test-sendfile", async (req, res) => {
    await res.sendFile("package.json", { root: __sys__.__root__ });
});

app.get("/test-download", async (req, res) => {
    await res.sendFile("package.json", {
        root: __sys__.__root__,
        disposition: "attachment",
    });
});

app.get("/test-custom-headers", async (req, res) => {
    await res.sendFile("package.json", {
        root: __sys__.__root__,
        headers: {
            "X-Test": "Hello-XHSC",
        },
    });
});

// --- Response Control Dynamic Tests ---

// 1. Enable JSON 403 Response
app.get("/rc/json-403", (req, res) => {
    app.setResponseControl({
        enabled: true,
        statusCode: 403,
        content: { error: "Security Restriction", detail: "Access denied by ResponseControl" },
        contentType: "application/json"
    });
    res.send("ResponseControl set to JSON 403. Try accessing any unknown route.");
});

// 2. Enable Plain Text 410 Response
app.get("/rc/text-410", (req, res) => {
    app.setResponseControl({
        enabled: true,
        statusCode: 410,
        content: "This resource is gone forever.",
        contentType: "text/plain"
    });
    res.send("ResponseControl set to Text 410. Try accessing any unknown route.");
});

// 3. Enable Custom Handler
app.get("/rc/handler", (req, res) => {
    app.setResponseControl({
        enabled: true,
        handler: (req, res) => {
            res.status(200).send(`Captured 404 for: ${req.path}. We returned 200 just to be weird.`);
        }
    });
    res.send("ResponseControl set to Custom Handler (200 OK). Try accessing any unknown route.");
});

// 4. Disable Response Control (Back to default NotFound template)
app.get("/rc/disable", (req, res) => {
    app.setResponseControl({ enabled: false });
    res.send("ResponseControl disabled. Back to default NotFound visual template.");
});

console.log("app name: ", __sys__.vars);

app.start();

