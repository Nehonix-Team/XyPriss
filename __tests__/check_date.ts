import { XyPrissRunner } from "../src/sys/XyPrissRunner";
import { SysApi } from "../src/sys/SysApi";

const runner = new XyPrissRunner(process.cwd());
const sys = new SysApi(runner);

const stats = sys.$stats("scripts/test-fs-full.ts");
console.log("Raw Created:", stats.created);
console.log("Date Object:", new Date(stats.created * 1000));

