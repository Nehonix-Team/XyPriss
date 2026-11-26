import { __sys__ } from "./src/index";

console.log("globalThis.__sys__ exists:", Boolean(globalThis.__sys__));
console.log("__sys__.__env__ exists:", Boolean(__sys__?.__env__));
if (__sys__?.__env__) {
    console.log("PORT:", __sys__.__env__.get("PORT"));
    console.log("NODE_ENV:", __sys__.__env__.get("NODE_ENV"));
}
