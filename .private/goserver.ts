import { __sys__, createServer, XyPrissSys } from "../src";

const app = createServer();

console.log("sys info: ", (__sys__ as XyPrissSys).$battery());

// (__sys__ as XyPrissSys).$watchAndProcess(
//     "package.json",
//     () => {
//         console.log("package.json changed");
//     },
//     { duration: 30 },
// );

(__sys__ as XyPrissSys).$compress("package.json", "pk2.test.gz");

app.start(7628);

