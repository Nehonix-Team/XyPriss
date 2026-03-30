import { createServer, FileUploadAPI } from "../src";

// Créez d'abord la configuration

// Gelez toute la configuration avant de la passer
const app = createServer({
    fileUpload: {},
});

app.get("/test", (req, res) => {
    res.json({ message: "Hello World!" });
});

const user = __sys__.__env__.user();
console.log("users: ", user);

console.log(
    "env de HELLO (depuis la 'root' du project)): ",
    __sys__.__env__.get("HELLO"),
);
console.log(
    "env de SALUT (depuis le 'private' du project)): ",
    __sys__.__env__.get("SALUT"),
);
console.log(
    "env de COMMON_VAR (je fais référence aux env de mon projecte de test '.private'): ",
    __sys__.__env__.get("COMMON_VAR", ""),
);

const info = __sys__.os.info();
// const cpu = __sys__.os.cpu();
// const memory = __sys__.os.memory();

console.log("tempDir: ", __sys__.path.tempDir());
console.log("sys info: ", info);
console.log("platform: ", __sys__.os.platform());
// app.start();



