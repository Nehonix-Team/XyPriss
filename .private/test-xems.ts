import fetch from "node-fetch";

async function run() {
    console.log("Logging in to get initial token...");
    const loginRes = await fetch("http://localhost:8085/test/xems/login");
    const cookie = loginRes.headers.get("set-cookie");

    if (!cookie) {
        console.error("No cookie returned!");
        return;
    }

    const token = cookie.split(";")[0];
    console.log("Got initial token:", token);

    console.log("\nSending 3 concurrent requests with the SAME token...");

    const reqs = Array.from({ length: 3 }).map(async (_, i) => {
        try {
            console.log(`Req ${i + 1}: Sent`);
            const res = await fetch("http://localhost:8085/test/xems/me", {
                headers: {
                    Cookie: token,
                },
            });
            const text = await res.text();
            console.log(
                `Req ${i + 1}: Status ${res.status} | Response: ${text}`,
            );

            if (res.status === 401) {
                console.error(`❌ Req ${i + 1} FAILED with 401 Unauthorized`);
            } else {
                console.log(`✅ Req ${i + 1} SUCCESS`);
            }
        } catch (e) {
            console.error(`Req ${i + 1} errored:`, e);
        }
    });

    await Promise.all(reqs);
    console.log("Done testing concurrency");

    console.log("\nWaiting 2.5 seconds to test TTL expiration...");
    await new Promise((resolve) => setTimeout(resolve, 2500));

    console.log("Sending request to test token expiration...");
    const expiredRes = await fetch("http://localhost:8085/test/xems/me", {
        headers: {
            Cookie: token,
        },
    });

    if (expiredRes.status === 401) {
        console.log("✅ Token successfully expired (401 Unauthorized)");
    } else {
        console.error(`❌ Expected 401, but got ${expiredRes.status}`);
    }
}

run();

