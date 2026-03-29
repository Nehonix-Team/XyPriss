import axios from "axios";

console.log("======================Testing rate limit===========");

for (let x = 0; x <= 400; x++) {
    async function call() {
        try {
            await axios.get("http://localhost:3001/api/user");
            console.log("✅ Passed for X=" + x);
        } catch (error) {
            if (error.response.status === 429) {
                console.error(
                    "❌ For 'X=" + x + "' Error while testing rate limit: ",
                    error.response.data
                );
            } else {
                console.error(
                    "❌ For 'X=" + x + "' Unexpected error: ",
                    error.response.status,
                    error.response.data
                );
            }
        }
    }
    call();
}

