// Test file to demonstrate that the TypeScript interface fix is working
// This shows that UltraFastApp now properly extends Express

import { Express, Request, Response } from "express";

// Import the UltraFastApp interface from the types file
import { UltraFastApp } from "../integrations/express/types/types";

// This should compile without errors now that UltraFastApp extends Express properly
function testUltraFastAppInterface(app: UltraFastApp) {
    // These Express methods should now be available without TypeScript errors
    app.get("/test", (req: Request, res: Response) => {
        res.send("GET works");
    });

    app.post("/test", (req: Request, res: Response) => {
        res.send("POST works");
    });

    app.put("/test", (req: Request, res: Response) => {
        res.send("PUT works");
    });

    app.delete("/test", (req: Request, res: Response) => {
        res.send("DELETE works");
    });

    app.use((req: Request, res: Response, next) => {
        console.log("Middleware works");
        next();
    });

    // XyPrissSecurity specific methods should also be available
    app.start(3000, () => {
        console.log("Server started on port:", app.getPort());
    });
}

console.log("TypeScript interface test completed successfully!");

