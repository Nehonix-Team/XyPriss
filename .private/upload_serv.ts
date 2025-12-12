import { createServer, Configs, Upload, Plugin } from "../src";

const app = createServer({
    server: {
        autoParseJson: false,
    },
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        storage: "memory",
    },

    network: {
        proxy: {},
    },
});

// console.log(Configs.get("fileUpload"));

Plugin.exec(
    Plugin.create({
        name: "test",
        version: "1.0.0",
        onServerStart(server) {
            console.log("Server started");
        },
    })
);

app.post("/upload", Upload.array("file", 3), (req, res) => {
    console.log("Upload route hit, req.file:", (req as any).files);
    console.log("Request headers:", req.headers);
    if ((req as any).files && (req as any).files.length > 0) {
        res.json({ success: true, files: (req as any).files });
    } else {
        res.json({ success: false, error: "No file uploaded" });
    }
});

app.start();

