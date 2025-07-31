async function r() {
    try {
        const res = await fetch("http://localhost:5000");

        // Log response info
        console.log("Status:", res.status);
        console.log("Status Text:", res.statusText);
        console.log("Headers:", Object.fromEntries(res.headers));

        // Read the actual response body
        const contentType = res.headers.get("content-type");
        let data;

        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        } else {
            data = await res.text();
        }

        console.log("Response Data:", data);

        return { status: res.status, data };
    } catch (err) {
        console.error("Error:", err);
        return { error: err.message };
    }
}

const lm = 4;

// Use async/await to handle the promises properly
async function runRequests() {
    for (let x = 0; x < lm; x++) {
        console.log(`\n--- Request ${x + 1} ---`);
        await r();

        // Optional: Add delay between requests to avoid rate limiting
        if (x < lm - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}

runRequests();
