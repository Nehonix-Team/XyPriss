import {
    createServer,
    FileUploadAPI,
    ProcessInfo,
    Router,
    Upload,
} from "../src";
import { SwaggerPlugin } from "../mods/swagger/src";

// Créez d'abord la configuration
const router = Router();

// Gelez toute la configuration avant de la passer
const app = createServer({
    // logging: {
    //     enabled: true,
    //     level: "debug",
    //     types: { debug: true },
    // },
    fileUpload: {
        enabled: true,
        destination: "./.data/uploads",
        allowedMimeTypes: ["image/png", "image/jpeg"],
        maxFileSize: 1024, // 1KB
    },
    cache: {
        enabled: true,
    },
    plugins: {
        register: [
            SwaggerPlugin({
                path: "/api-docs",
                port: 8086,
                title: "XyPriss Router V2 API",
                version: "2.0.0",
                description: "Test environment for ultra-rich routing features",
            }),
        ],
    },
    pluginPermissions: [
        {
            name: "@xypriss/swagger",
            allowedHooks: ["PLG.OPS.AUXILIARY_SERVER"],
        },
    ],
});
// __sys__ = {nothing: true}

app.get("/test", (req, res) => {
    res.json({ message: "Hello World!" });
});

const user = __sys__.__env__.user();
console.log("users: ", user);

console.log(
    "env de HELLO (depuis la 'root' du project): ",
    __sys__.__env__.get("HELLO"),
);
console.log(
    "🙂 env de SALUT (depuis le 'private' du project: devrait être undefined): ",
    __sys__.__env__.get("SALUT"),
);
console.log(
    "env de COMMON_VAR du root du project: ",
    __sys__.__env__.get("COMMON_VAR", ""),
);

const info = __sys__.os.info();
// const cpu = __sys__.os.cpu();
// const memory = __sys__.os.memory();

console.log("tempDir: ", __sys__.path.tempDir());
console.log(
    "plg env::NAME -> ",
    __sys__.plugins.get("@xypriss/swagger")?.__env__.get("NAME"),
);
// console.log("sys info: ", info);
console.log("app name: ", __sys__.vars.__name__);

// Configure FileUpload
const upload = new FileUploadAPI();

app.post("/upload", upload.single("file"), (req, res) => {
    res.json({
        success: true,
        file: (req as any).file,
    });
});

const adminGuard = (req: any, res: any) => {
    const token = req.headers["authorization"];
    if (token === "secret-token") return true;
    return "Unauthorized: Admin access required";
};

router.post("/upload-modular", router.upload.single("file"), (req, res) => {
    res.success("Modular File received");
});

router.group({ prefix: "/api", version: "v2" }, (api) => {
    // Inherits prefix "/api/v2"
    api.get("/status", (req, res) => res.success("V2 Active"));

    api.group({ prefix: "/admin", guards: [adminGuard] }, (admin) => {
        // Inherits "/api/v2/admin" + adminGuard
        admin.get("/users", (req, res) => res.success("Admin access granted"));
    });
});

router.get(
    "/router/test",
    { rateLimit: { max: 2, windowMs: 1000 } },
    (req, res) => {
        res.success("Test");
    },
);

let callCount = 0;
router.get("/router/cached", { cache: "40s" }, (req, res) => {
    callCount++;
    res.json({ count: callCount });
});

router.get(
    "/router/lifecycle",
    {
        lifecycle: {
            onError(err: any, req, res, next) {
                console.log(
                    "[LIFECYCLE] Error captured: ",
                    (err as any).message,
                );
                next();
            },
            beforeEnter: (req, res, next) => {
                (req as any).hooked = true;
                next();
            },
            afterLeave: (req, res, duration) => {
                console.log(`[LIFECYCLE] Route finished in ${duration}ms`);
            },
        },
    },
    (req, res) => {
        throw new Error("Error in route");
        res.success(`Hooked: ${(req as any).hooked}`);
    },
);

console.log("__sys__ root: ", __sys__.__root__);




app.use(router);
app.start();


