import { createServer, Configs } from "../src";
import { Uploader as upload } from "../src";

const app = createServer({
    server: {
        autoParseJson: false,
    },
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        storage: "memory",
    },
    
    logging: {}
});

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

