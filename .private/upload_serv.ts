import {
    createServer,
    Configs,
    Upload,
    Plugin,
    XJsonResponseHandler,
} from "../src";

const app = createServer({});

// console.log(Configs.get("fileUpload"));

// Use the new XJson endpoint for large data
app.get("/.xJson", (req, res) => {
    const d = {
        success: true,
        file: {
            id: "cmj17uh7f00002ef4otv5rqlj",
            filename: "d0442818d2ea900d737286c0af2c5323.txt",
            originalName: "test_simple.txt",
            size: 18n,
            mimeType: "text/plain",
            url: "http://localhost:3001/api/v1/services/ncs2/files/cmj17kvja00005tf4jqa9383w/d0442818d2ea900d737286c0af2c5323.txt",
        },
    };

    // Use the new xJson method for handling large data
    res.xJson(d);
});

// Keep the original endpoint for backward compatibility
app.get("/", (req, res) => {
    const d = {
        success: true,
        file: {
            id: "cmj17uh7f00002ef4otv5rqlj",
            filename: "d0442818d2ea900d737286c0af2c5323.txt",
            originalName: "test_simple.txt",
            size: 218n,
            mimeType: "text/plain",
            url: "http://localhost:3001/api/v1/services/ncs2/files/cmj17kvja00005tf4jqa9383w/d0442818d2ea900d737286c0af2c5323.txt",
        },
    };

    res.json(d);
});

app.start();

