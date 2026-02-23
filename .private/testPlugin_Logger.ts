import { Plugin } from "../src";

export const logger = Plugin.create({
  name: "internal-logger",
  version: "1.0.0",
  onRequest(req, res, next) {
    console.log("Request: ", req.method, req.url);
    next();
  },
  onResponse(req, res) {
    console.log("Response: ", res.statusCode);
  },
  onError(error, req, res, next) {
    console.log("Error: ", error);
    next?.();
  },
  onServerReady(server) {
    console.log("Server ready: ", server.address());
  },
});
