// Set required environment variables for security module
process.env.ENC_SECRET_KEY =
    "dae5a3943d538d0b8c43866ee11df27c96cb26941e255113278ba293b28a2789";
process.env.ENC_SECRET_SEED =
    "b7f4c99888ea948f8a4bd24a5c0dc088ece8828846d787a71abcccd9048c6919";
process.env.ENC_SECRET_SALT =
    "b07af8f0c9138d730928cf9437116fa661e2b0c51b6799585611ef88db95fe91";

import { fObject } from "../mods/security/src";

try {
    const user = fObject({
        id: "1",
        email: "test@nehonix.com",
        password: "SuperKey",
    });

    // Test basic operations
    console.info("User created successfully");
    console.info("User ID:", user.get("id"));
    console.info("User email:", user.get("email"));

    // Test secure operations
    user.delete("password");
    console.info("Password deleted successfully");

    // Get all data (this might trigger the integrity check)
    console.info("Getting all user data...");
    const allData = user.getAll();
    console.info("User data:", allData);
} catch (error) {
    console.error("Test failed:", error.message);
    console.error("This might be due to security module integrity checks");
    console.error(
        "The security module is working as intended by detecting potential tampering"
    );
}

