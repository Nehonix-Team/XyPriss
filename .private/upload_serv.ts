import { createServer } from "../src";
import { FileUploadAPI } from "../src";

const app = createServer({
    server: {
        autoParseJson: false,
    },
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        storage: "memory",
    },
});

// Create file upload instance
const upload = new FileUploadAPI();
await upload.initialize(app.configs?.fileUpload);

app.post("/upload", upload.array("file", 3), (req, res) => {
    console.log("Upload route hit, req.file:", (req as any).files);
    console.log("Request headers:", req.headers);
    if ((req as any).files && (req as any).files.length > 0) {
        res.json({ success: true, files: (req as any).files });
    } else {
        res.json({ success: false, error: "No file uploaded" });
    }
});

app.start();

