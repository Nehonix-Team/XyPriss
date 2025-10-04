import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import FormData from "form-data";

async function testManualMulter() {
    try {
        console.log("Testing manual multer integration...");

        // Read the GIF file
        const gifPath = path.join(__dirname, "assets", "Data Loading Animation.gif");
        console.log("Reading file from:", gifPath);

        if (!fs.existsSync(gifPath)) {
            console.error("GIF file not found at:", gifPath);
            return;
        }

        const fileBuffer = fs.readFileSync(gifPath);
        console.log("File size:", fileBuffer.length, "bytes");

        // Create FormData
        const formData = new FormData();
        formData.append("file", fileBuffer, {
            filename: "Data Loading Animation.gif",
            contentType: "image/gif"
        });

        console.log("Sending POST request to http://localhost:3002/upload-manual");

        // Send the request
        const response = await axios.post("http://localhost:3002/upload-manual", formData, {
            headers: {
                ...formData.getHeaders(),
            },
            timeout: 10000,
        });

        console.log("Response status:", response.status);
        console.log("Response data:", JSON.stringify(response.data, null, 2));

        if (response.data.success && response.data.method === "manual") {
            console.log("✅ Test PASSED: Manual multer integration works!");
        } else {
            console.log("❌ Test FAILED: Manual multer integration failed");
        }

    } catch (error: any) {
        console.error("❌ Test FAILED: Error occurred");
        console.error("Error message:", error.message);

        if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response data:", error.response.data);
        } else if (error.code === "ECONNREFUSED") {
            console.error("Connection refused - make sure the manual multer server is running on port 3002");
        }
    }
}

// Run the test
testManualMulter();