import { ConfigSyntaxParser } from "./src/utils/ConfigSyntaxParser";

const parser = new ConfigSyntaxParser(
    { name: "test-pkg" },
    { has: (k) => true, get: (k) => k === "PORT" ? "8080" : "test-env" }
);

const config = {
    port: "&(env).PORT",
    pkgName: "&(pkg).name",
    timestamp: "&(date).TS",
    selfRef: "&(this).port",
    nested: {
        ref: "&(this).pkgName"
    },
    $vars: {
        host: "localhost",
        port: 3000
    },
    baseUrl: "http://&(this).$vars.host:&(this).$vars.port",
    logFile: "server-&(date).YEAR-&(date).MONTH.log",
    cert: "&(file).src/index.ts",
    cert2: "&(file).../src/index.ts"
};

const resolved = parser.resolve(config);
console.log(resolved);
