import { __strl__, MaliciousPatternType } from "strulink";

const xssPayload =
    "http://localhost:8085/rc/handler/<script>alert(document.cookie)</script>";
const legitUrl = "http://localhost:8085/rc/handler/status";

async function runCases() {
    console.log("-- Default scan (broad)");
    console.log(await __strl__.scanUrl(xssPayload));

    console.log("-- Scan with XSS only, strict");
    console.log(
        await __strl__.scanUrl(xssPayload, {
            enabledPatternTypes: [MaliciousPatternType.XSS],
            minScore: 30,
            sensitivity: 1.2,
        }),
    );

    console.log(
        "-- Permissive scan (low sensitivity) to check false positives",
    );
    console.log(
        await __strl__.scanUrl(xssPayload, {
            sensitivity: 0.5,
            minScore: 90,
        }),
    );

    console.log("-- Legitimate URL scan (should not be flagged)");
    console.log(
        await __strl__.scanUrl(legitUrl, {
            sensitivity: 1.0,
            minScore: 50,
        }),
    );
}

await runCases();

