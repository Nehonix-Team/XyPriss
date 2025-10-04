import { createServer } from "../src";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";

const app = createServer({
    server: {
        port: 3002,
    },
    security: {
        enabled: false, // Disable for testing
    },
});

// Manual multer setup (traditional way)
const manualUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024 * 10, // 10MB
    },
    fileFilter: (req, file, cb) => {
        // Allow all files for this test
        cb(null, true);
    }
});

app.post("/upload-manual", manualUpload.single("file") as any, (req: any, res) => {
    console.log("Manual multer - File received:", req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
    } : "No file");

    if (req.file) {
        res.json({
            success: true,
            message: "File uploaded with manual multer",
            method: "manual",
            file: {
                name: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype,
            },
        });
    } else {
        res.status(400).json({
            success: false,
            message: "No file uploaded",
        });
    }
});

app.get("/", (req, res) => {
    res.send("Manual multer test server running. POST to /upload-manual with a file.");
});

console.log("Starting manual multer test server on port 3002...");
app.start();