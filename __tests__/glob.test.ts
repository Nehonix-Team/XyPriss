import { fObject, fString, Random } from "xypriss-security";

const data = fString("performance-test");

const benchmark = await data.benchmarkOperation(
    async () => await Random.getRandomBytes(32),
    "SHA-256 Hash",
    10000
);
console.log(benchmark.operationsPerSecond);

