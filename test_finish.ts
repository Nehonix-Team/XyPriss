import { XHSCResponse, XHSCRequest } from "./src/server/core/XHSCProtocol.ts";

const req = new XHSCRequest({ method: "GET", url: "/" });
const res = new XHSCResponse(req, (data, status, headers) => {
    console.log("onFinalize called");
});

res.on("finish", () => {
    console.log("Finish event triggered!");
});

res.end("hello");
