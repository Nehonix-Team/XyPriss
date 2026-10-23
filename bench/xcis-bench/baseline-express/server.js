const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8086;

app.use("/static", express.static(path.join(__dirname, "public"), {
  etag: true,
  lastModified: true,
  maxAge: 0,
}));

app.use(express.json());

const BENCH_JSON_PAYLOAD = {
  status: "success",
  message: "XyPriss Performance Benchmark",
  timestamp: 1775242800,
  payload: {
    id: 1024,
    user: "nehonix_developer",
    roles: ["admin", "developer", "tester"],
    meta: { active: true, score: 98.6 },
  },
};

app.get("/json", (req, res) => {
  res.json(BENCH_JSON_PAYLOAD);
});

app.post("/json", (req, res) => {
  res.json({
    status: "created",
    received: req.body,
  });
});

const ROUTE_RESOURCES = [
  "users", "accounts", "teams", "workspaces", "members",
  "roles", "permissions", "invites", "settings", "audit",
  "billing", "plans", "invoices", "payments", "cards",
  "products", "items", "categories", "tags", "collections",
  "inventory", "warehouses", "suppliers", "shipments", "orders",
  "discounts", "coupons", "carts", "checkouts", "reviews",
  "posts", "articles", "blogs", "authors", "comments",
  "likes", "shares", "bookmarks", "media", "uploads",
  "documents", "folders", "files", "templates", "versions",
  "tasks", "projects", "milestones", "sprints", "epics"
];

for (const resName of ROUTE_RESOURCES) {
  app.get(`/api/v1/${resName}/:id`, (req, res) => {
    res.json({ resource: resName, id: req.params.id });
  });
}

app.get("/api/v1/orgs/:orgId/projects/:projectId/issues/:issueId", (req, res) => {
  res.json({
    org: req.params.orgId,
    project: req.params.projectId,
    issue: req.params.issueId,
    query: req.query,
  });
});

app.get("/ping", (req, res) => res.send("pong"));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[express] listening on 127.0.0.1:${PORT}`);
});
