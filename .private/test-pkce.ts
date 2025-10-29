import * as crypto from "crypto";
import { Cipher } from "../mods/security/src/core/crypt";
// import { Cipher } from "xypriss-security";

// Code verifier du frontend mobile (des logs)
const codeVerifier =
  "uCoEh3q6tUR0_eVlsr6b6qjfzeWf_jnfoif8XQvTPeMq~zG6MyiEyhAroiJrmcrCb8JNqd6tSqvYX~1nLcD29.QU~iIxeGZleMeiiC1vfd.hLns0MuQZuTL.NqByFF0K";

// Code challenge stocké dans le backend (des logs)
const storedChallenge = "eHjZE0STxWg9BRtooH5xl3J5SZ__EUUvjv_UQZXgUII";

// Calculer le challenge comme le backend le fait maintenant
const computedChallenge = crypto
  .createHash("sha256")
  .update(codeVerifier)
  .digest("base64")
  .replace(/\+/g, "-") 
  .replace(/\//g, "_")
  .replace(/=/g, "");

console.log("PKCE Test Results:");
console.log("Code Verifier:", codeVerifier);
console.log("Stored Challenge:", storedChallenge);
console.log("Computed Challenge:", computedChallenge);
console.log("Match:", computedChallenge === storedChallenge);

// // Test aussi avec l'ancienne méthode Cipher.hash
// import { Cipher } from "xypriss-security";
const oldMethodChallenge = Cipher.hash
  .create(codeVerifier)
  .toString("base64url");

// Test the new PKCE method
const pkceChallenge = Cipher.hash.pkce(codeVerifier);

console.log("New PKCE Method (Cipher.hash.pkce):", pkceChallenge);
console.log("New PKCE Method Match:", pkceChallenge === storedChallenge);

/**
 * .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');
 */
