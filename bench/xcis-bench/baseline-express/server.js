const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8086;

app.use("/static", express.static(path.join(__dirname, "public"), {
  etag: true,
  lastModified: true,
  maxAge: 0,
}));

app.get("/ping", (req, res) => res.send("pong"));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[express] listening on 127.0.0.1:${PORT}`);
});
