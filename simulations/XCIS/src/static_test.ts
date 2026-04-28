import { createServer, __sys__, XStatic } from "xypriss";
import { join } from "path";

const app = createServer({
    performance: {
        preAllocate: true
    },
    static: {
        zeroCopy: true,
        lruCacheSize: 1000,
        dotfiles: "deny"
    }
});

// New Optimized Syntax (Manual Instantiation)
const xs = new XStatic(app, __sys__);

// Define static routes
xs.define("/assets", join(process.cwd(), "public"));

app.get("/test", (req, res) => {
    res.send("XStatic Test Server Ready (Optimized Syntax)");
});

app.start(() => {
    console.log("XStatic Test Server started at http://localhost:5628");
    console.log("Testing: http://localhost:5628/assets/hello.txt");
    console.log("Testing (Dotfile): http://localhost:5628/assets/.secret.txt (Should be 403)");
    console.log("Testing (Nested): http://localhost:5628/assets/nested/file.txt");
    console.log("Testing (Traversal): http://localhost:5628/assets/../src/server.ts (Should be 403)");
});
