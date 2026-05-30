import { createServer } from "xypriss";
import { XStatic } from "xypriss";

const app = createServer({
    security: { enabled: false }
});

const xs = new XStatic(app, global.__sys__ || {});
xs.define("/static", "public");

console.log(JSON.stringify(app.getHttpServer().middlewareManager.getStats(), null, 2));
process.exit(0);
