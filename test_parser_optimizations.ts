import { ConfigSyntaxParser } from "./src/utils/ConfigSyntaxParser";

const parser = new ConfigSyntaxParser(
    { name: "test-pkg" },
    { has: (k) => true, get: (k) => k === "PORT" ? "8080" : "test-env" },
    { VERSION: "1.2.3" }
);

const config = {
    port: "&(env).PORT",
    pkgName: "&(pkg).name",
    version: "&(const).VERSION",
    timestamp: "&(date).TS",
    selfRef: "&(this).port",
    nested: {
        ref: "&(this).pkgName"
    }
};

const resolved = parser.resolve(config);
console.log(resolved);
