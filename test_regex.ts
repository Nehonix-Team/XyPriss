import { compileRoutePattern } from "./src/server/routing/modules/path";

const testPath = "/files/:name.:ext";
const { pattern, paramNames } = compileRoutePattern(testPath, {
    strict: false,
});

console.log("Path:", testPath);
console.log("Pattern:", pattern.source);
console.log("Param Names:", paramNames);

const testUrl = "/files/image.png";
const match = pattern.exec(testUrl);

if (match) {
    console.log("Match found!");
    paramNames.forEach((name, i) => {
        console.log(`  ${name}: ${match[i + 1]}`);
    });
} else {
    console.log("No match.");
}

