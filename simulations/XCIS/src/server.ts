import { createServer, Plugin } from "xypriss";
import { XyphraPlugin } from "xyphra";

const app = createServer({
    static: {},
    plugins: {
        register: [
            XyphraPlugin({
                anonymizeIp: true,
                // format: "string",
                tokens: {
                    remote: (req, res) => {
                        return req.socket.remoteAddress || "";
                    },
                },

                immediate: false,
                stream: {
                    write(str: string) {
                        console.log(str);
                    },
                },
            }),
        ],
    },
});

// app.static;

app.get("/ping", (req, res) => {
    res.send("pong");
});

app.start();


