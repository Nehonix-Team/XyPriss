import { spawn } from "child_process";

const server = spawn("bun", ["src/server.ts"], {
  cwd: "/home/idevo/Documents/projects/XyPriss/simulations/XCIS",
  stdio: "pipe",
});

server.stdout.on("data", (data) => process.stdout.write(data));
server.stderr.on("data", (data) => process.stderr.write(data));

setTimeout(async () => {
  console.log("\n--- Sending request ---");
  try {
    const res = await fetch("http://localhost:8085/not-found");
    console.log(`Status: ${res.status}`);
  } catch (e) {
    console.error("Fetch failed", e);
  }
  
  setTimeout(() => {
    console.log("--- Shutting down ---");
    server.kill();
    process.exit(0);
  }, 2000);
}, 5000);
