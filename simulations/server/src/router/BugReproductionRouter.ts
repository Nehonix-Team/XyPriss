import { Router } from "xypriss";

export const bugReproductionRouter = Router();

// --- Path Parameters ---
bugReproductionRouter.get("/users/:id", (req, res) => {
    res.json({ userId: req.params.id });
});

bugReproductionRouter.get("/posts/:year/:month/:slug", (req, res) => {
    res.json(req.params);
});

// --- Regex Constraints ---
bugReproductionRouter.get("/regex/:id(\\d+)", (req, res) => {
    res.json({ userId: req.params.id });
});

bugReproductionRouter.get("/shop/:slug([a-z]+-[a-z]+-[a-z]+)", (req, res) => {
    res.json({ slug: req.params.slug });
});

// --- Typed Parameters ---
bugReproductionRouter.get("/items/:id<number>", (req, res) => {
    res.json({ id: req.params.id });
});

bugReproductionRouter.get("/jobs/:uuid<uuid>", (req, res) => {
    res.json({ uuid: req.params.uuid, params: req.params });
});

bugReproductionRouter.get("/category/:name<alpha>", (req, res) => {
    res.json({ category: req.params.name });
});

// --- Multiple Parameters in One Segment ---
bugReproductionRouter.get("/archive/:year-:month-:day", (req, res) => {
    res.json(req.params);
});

bugReproductionRouter.get("/files/:name.:ext", (req, res) => {
    res.json(req.params);
});

// --- Wildcards ---
bugReproductionRouter.get("/one-segment/*", (req, res) => {
    res.json({ filename: req.params["*"] });
});

bugReproductionRouter.get("/api/**", (req, res) => {
    res.json({ capturedPath: req.params["**"] });
});

bugReproductionRouter.get("/users/:id/data/**", (req, res) => {
    res.json({ userId: req.params.id, dataPath: req.params["**"] });
});

// --- Query Parameters ---
bugReproductionRouter.get("/search", (req, res) => {
    res.json({ query: req.query.q, limit: req.query.limit });
});

// --- Redirects ---
// Redirect /old/:id to /file/users/:id
bugReproductionRouter.redirect("/old/:id", "/file/users/:id");
bugReproductionRouter.redirect("/legacy/:name", "/file/category/:name");

