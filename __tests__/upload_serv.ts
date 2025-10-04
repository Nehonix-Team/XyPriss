import { createServer } from "../src";

const app = createServer({
    server: {
        port: 3001,
    },
    fileUpload: {
        enabled: true,
        maxFileSize: 1, // 1MB for testing
        multerOptions: {},
        storage: "memory", // Use memory storage for testing
        
    },
    security: {
        enabled: false, // Disable for testing
    },
});

app.post("/upload", app.uploadSingle("file"), (req: any, res) => {
    console.log(
        "File received:",
        req.file
            ? {
                  fieldname: req.file.fieldname,
                  originalname: req.file.originalname,
                  encoding: req.file.encoding,
                  mimetype: req.file.mimetype,
                  size: req.file.size,
              }
            : "No file"
    );

    if (req.file) {
        res.json({
            success: true,
            message: "File uploaded successfully",
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
    res.send("Upload server is running. POST to /upload with a file.");
});

console.log("Starting upload test server on port 3001...");
app.start();

