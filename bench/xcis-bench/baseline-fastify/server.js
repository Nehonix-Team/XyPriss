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

fastify.get("/json", async () => BENCH_JSON_PAYLOAD);

fastify.post("/json", async (req) => {
  return {
    status: "created",
    received: req.body,
  };
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
  fastify.get(`/api/v1/${resName}/:id`, async (req) => {
    return { resource: resName, id: req.params.id };
  });
}

fastify.get("/api/v1/orgs/:orgId/projects/:projectId/issues/:issueId", async (req) => {
  return {
    org: req.params.orgId,
    project: req.params.projectId,
    issue: req.params.issueId,
    query: req.query,
  };
});

fastify.get("/ping", async () => "pong");

fastify.listen({ port: PORT, host: "127.0.0.1" }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`[fastify] listening on 127.0.0.1:${PORT}`);
});
