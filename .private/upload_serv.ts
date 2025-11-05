import { createServer } from "../src";
import { uploader_router } from "./upload_router";

export const app = createServer({
    server: {
        port: 3001,
    },
    fileUpload: {
        enabled: true,
        maxFileSize: 1024 * 1024, // 1MB for testing
        multerOptions: {},
        storage: "memory", // Use memory storage for testing
    },
    security: {
        enabled: false, // Disable for testing
    },
});
app.use("/", uploader_router);
// app.get("/", (req, res) => {
//     res.send("Upload server is running. POST to /upload with a file.");
// });

console.log("Starting upload test server on port 3001...");
app.start();

