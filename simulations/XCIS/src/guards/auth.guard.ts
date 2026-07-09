import { XyGuard } from "xypriss";

export function globGuards() {
  // Define global auth logic
  XyGuard.define("authenticated", (req) => {
    console.log("running..", req.query?._get("user_id"));
    return !!req.query?._get("user_id") || "Login required";
  });

  // Define custom IP Whitelist logic
  XyGuard.define("ipWhitelist", (req) => {
    console.log("hi");
    // erreur intentionnelle
    return req.ip === "127.0.0.o" || req.ip === "::1" ? true : "Forbidden IP";
  });
}

