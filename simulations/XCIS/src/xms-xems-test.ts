import { createServer, Send, XServer } from "xypriss";

// Auth Server Configuration
const authServer = {
  id: "auth_server",
  port: 6278,
  routePrefix: "/auth",
  security: {
    csrf: false,
  },
};

// Main Server Configuration
const mainServer = {
  id: "main_server",
  port: 8088,
  routePrefix: "/api",
};

// Create Multi-Server App
const app = XServer.create({
  server: {
    port: 8000,
    xems: {
      enable: true,
      attachTo: "session",
      autoRotation: false,
      persistence: {
        enabled: true,
        path: "./.store/vault.xems",
        secret: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92", // 64 hex chars = 32 bytes secret
      },
    },
  },
  multiServer: {
    enabled: true,
    servers: [authServer, mainServer],
  },
  security: {
    enabled: false,
  },
});

// Configure auth routes
app.post("/auth/login", async (req, res) => {
  const send = new Send(res);
  
  // Simulated login logic
  const userData = { userId: 1, username: "idevo", role: "admin" };
  
  // Creates token in xems and sends back cookie
  await (res as any).xLink(userData);
  
  console.log("[AUTH] Login successful, session created: ", (req as any).session);
  return send.ok("Login successful", userData);
});

// Configure check routes
app.get("/api/check", async (req, res) => {
  const send = new Send(res);
  
  console.log("[CHECK] req.cookies: ", (req as any).cookies);
  // Reading session from xems
  const session = (req as any).session;
  console.log("[CHECK] session retrieved: ", session);
  
  if (!session) {
    return send.unauthorized("No session found");
  }
  
  return send.ok("Session valid", session);
});

app.start().then(() => {
  console.log("XyPriss Multi-Server started. Test XEMS with:");
  console.log("curl -X POST http://localhost:6278/auth/login -c cookie.txt");
  console.log("curl -b cookie.txt http://localhost:8088/api/check");
});
