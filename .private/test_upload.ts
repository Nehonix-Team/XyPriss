import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import FormData from "form-data";
 
async function testFileUpload() {
    try {
        console.log("Starting file upload test...");

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
        formData.append("testFIle", fileBuffer, {
            filename: "Data Loading Animation.gif",
            contentType: "image/gif",
        });

        console.log("Sending POST request to http://localhost:3001/upload");

        // Send the request
        const response = await axios.post("http://localhost:3001/upload", formData, {
            headers: {
                ...formData.getHeaders(),
            },
            timeout: 10000,
        });

        console.log("Response status:", response.status);
        console.log("Response data:", JSON.stringify(response.data, null, 2));

        if (response.data.success) {
            console.log("✅ Test PASSED: File upload successful!");
        } else {
            console.log("❌ Test FAILED: Server reported failure");
        }

    } catch (error: any) {
        console.error("❌ Test FAILED: Error occurred");
        console.error("Error message:", error.message);

        if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response data:", error.response.data);
        } else if (error.code === "ECONNREFUSED") {
            console.error("Connection refused - make sure the upload server is running on port 3001");
        }
    }
}

// Run the test

testFileUpload();