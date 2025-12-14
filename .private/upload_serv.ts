import {
    createServer,
    Configs,
    Upload,
    Plugin,
    XJsonResponseHandler,
} from "../src";

const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                port: 9822,
                id: "server 1",
                routePrefix: "/public/view",
                responseControl: {
                    enabled: true,
                    statusCode: 401,
                    // content: "Salut le monde",
                    handler(req, res) {
                        res.send("hello world");
                    },
                },
            },
            {
                port: 3728,
                id: "main server", // main server
            },
        ],
    },
});

app.get("/api/test", (req, res) => {
    res.send("Hello world from 'api/test' route");
});
app.get("/", (req, res) => {
    res.send("Hello world from '/' route");
});

app.get("/public/view", (req, res) => {
    res.send("Hello world from '/public/view' route");
});

// console.log(Configs.get("fileUpload"));

app.start();

