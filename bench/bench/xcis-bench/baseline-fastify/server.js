const fastify = require("fastify")({ logger: false });
const path = require("path");

const PORT = process.env.PORT || 8087;

fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/static/",
  etag: true,
  lastModified: true,
  maxAge: 0,
});

fastify.get("/ping", async () => "pong");

fastify.listen({ port: PORT, host: "127.0.0.1" }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`[fastify] listening on 127.0.0.1:${PORT}`);
});
