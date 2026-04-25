import { createServer, Plugin } from "xypriss";
import { XyphraPlugin } from "xyphra";

const app = createServer({
    security: {
        morgan: {},
    },

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

                immediate: true,
                stream: {
                    write(str: string) {
                        console.log(str);
                    },
                },
            }),
        ],
    },
});

app.start();
