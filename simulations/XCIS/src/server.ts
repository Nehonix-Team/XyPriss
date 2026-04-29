import { createServer, Plugin, XStatic } from "xypriss";
// import { XyphraPlugin } from "xyphra";

const app = createServer({
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

app.start();

