import { Router, Send } from "xypriss";

/**
 * Default Route Module.
 * Handles the main application logic for the standalone server.
 */
export const mainRouter = Router();

mainRouter.get("/", (req, res) => { 
const send = new Send(res)
send.ok("Standalone server is running", { 
        status: "online",
        timestamp: new Date().toISOString()
 }); 
 return
});
