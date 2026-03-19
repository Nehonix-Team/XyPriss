import { Hash, XStringify } from "xypriss-security";
import  "../src";

const secret = "your-shared-secret";
const payload = XStringify({ data: "example" }); // This is the same as JSON.stringify but it is faster and handle large objects
const signature = Hash.hmac(secret, payload, "sha256");
console.log("signature: ", signature);