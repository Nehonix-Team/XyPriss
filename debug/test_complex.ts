import { getSysApi } from "../src/plugins/const/getSysApi";
import { XStringify } from "xypriss-security";

const sys = getSysApi();
const complexObj = {
    meta: { timestamp: Date.now(), generator: "Nehonix-BattleTester" },
    items: Array.from({ length: 500 }, (_, i) => ({
        id: `item-${i}`,
        scores: [i * 1.5, i * 2.5, i * 3.5],
        tags: ["alpha", "beta", "gamma", "g5", "synapx"],
        nested: { level1: { level2: { value: `val-${i}` } } },
    })),
};
const str = JSON.stringify(complexObj);
console.log("Original len:", str.length);
sys.fs.writeFileSync("debug/test_complex.json", str);
const read = sys.fs.readFileSync("debug/test_complex.json");
console.log("Read len:", read.length);
console.log("Matches:", str === read);
try {
    const parsed = JSON.parse(read);
    console.log("JSON.parse success! Items:", parsed.items.length);
} catch (e) {
    console.error("JSON.parse failed:", e);
    console.log("Read content around end:", JSON.stringify(read.slice(-100)));
}
process.exit(0);

