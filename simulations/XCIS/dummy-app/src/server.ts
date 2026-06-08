import { createServer } from "xypriss";
import { serverConfigs } from "./configs/xypriss.config";
import router from "./router";

/**
 * XyPriss Server Instance (Default Mode)
 * 
 * Initializes a single-instance server using standard configurations.
 */
const app = createServer(serverConfigs);

/**
 * Global Router Integration
 * 
 * Mounts the main application router to manage service endpoints.
 */
app.use("/", router);

/**
 * Server Lifecycle Initialization
 * 
 * Starts the server engine and binds it to the defined port.
 */
app.start();
