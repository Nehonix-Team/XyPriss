import { NumberUtils } from "../../src/xhsc/utils/NumberUtils";

const num = new NumberUtils();

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

console.log("Running NumberUtils tests...");

// 1. File sizes & Storage
assert(num.formatBytes(0) === "0 Bytes", "formatBytes(0)");
assert(num.formatBytes(1024) === "1 KB", "formatBytes(1024)");
assert(num.formatBytes(1048576) === "1 MB", "formatBytes(1MB)");
assert(num.formatBytes(1073741824, { binary: true }) === "1 GiB", "formatBytes(binary GiB)");
assert(num.parseBytes("10MB") === 10485760, "parseBytes('10MB')");
assert(num.parseBytes("500 KB") === 512000, "parseBytes('500 KB')");
assert(num.parseBytes("1.5 GB") === 1610612736, "parseBytes('1.5 GB')");
assert(num.parseBytes("256 B") === 256, "parseBytes('256 B')");
assert(num.toKB(2048) === 2, "toKB");
assert(num.toMB(10485760) === 10, "toMB");
assert(num.toGB(1073741824) === 1, "toGB");
assert(num.toTB(1099511627776) === 1, "toTB");
assert(num.convertBytes(52428800, "MB") === 50, "convertBytes");
assert(num.transferRate(10485760, 2000) === "5 MB/s", "transferRate");
assert(num.transferETA(5000, 1000) === 5, "transferETA");

// 2. Percentages & Ratios
assert(num.percentage(25, 200) === 12.5, "percentage(25, 200)");
assert(num.percentage(0, 0) === 0, "percentage(0, 0)");
assert(num.percentageOf(20, 150) === 30, "percentageOf(20, 150)");
assert(num.percentageChange(100, 150) === 50, "percentageChange(100, 150)");
assert(num.percentageChange(200, 150) === -25, "percentageChange(200, 150)");
assert(num.progress(50, 100) === 0.5, "progress(50, 100)");
assert(num.progress(120, 100) === 1.0, "progress(120, 100)");

// 3. Rounding & Precision
assert(num.round(1.005, 2) === 1.01, "round(1.005, 2)");
assert(num.round(12.3456, 2) === 12.35, "round(12.3456, 2)");
assert(num.ceil(1.234, 2) === 1.24, "ceil(1.234, 2)");
assert(num.floor(1.239, 2) === 1.23, "floor(1.239, 2)");
assert(num.roundToStep(23, 5) === 25, "roundToStep(23, 5)");
assert(num.roundToStep(1.234, 0.05) === 1.25, "roundToStep(1.234, 0.05)");
assert(num.toPrecision(12345, 3) === 12300, "toPrecision(12345, 3)");

// 4. Bounds & Mapping
assert(num.clamp(15, 0, 10) === 10, "clamp(15, 0, 10)");
assert(num.clamp(-5, 0, 10) === 0, "clamp(-5, 0, 10)");
assert(num.inRange(5, 1, 10) === true, "inRange(5, 1, 10)");
assert(num.inRange(10, 1, 10, false) === false, "inRange(10, 1, 10, false)");
assert(num.normalize(50, 0, 100) === 0.5, "normalize(50, 0, 100)");
assert(num.lerp(0, 100, 0.5) === 50, "lerp(0, 100, 0.5)");
assert(num.mapRange(7.5, 0, 10, 0, 100) === 75, "mapRange(7.5, 0, 10, 0, 100)");

// 5. Statistics & Aggregates
assert(num.sum(1, 2, 3, 4) === 10, "sum variadic");
assert(num.sum([10, 20, 30]) === 60, "sum array");
assert(num.average(10, 20, 30) === 20, "average variadic");
assert(num.average([5, 15]) === 10, "average array");
assert(num.median(1, 3, 5) === 3, "median odd");
assert(num.median(1, 2, 3, 4) === 2.5, "median even");
assert(num.min(10, 5, 20) === 5, "min");
assert(num.max(10, 5, 20) === 20, "max");

// 6. Pagination & Division
const page = num.paginate(154, 20, 2);
assert(page.currentPage === 2, "paginate currentPage");
assert(page.totalPages === 8, "paginate totalPages");
assert(page.offset === 20, "paginate offset");
assert(page.limit === 20, "paginate limit");
assert(page.startIndex === 20, "paginate startIndex");
assert(page.endIndex === 39, "paginate endIndex");
assert(page.hasNext === true, "paginate hasNext");
assert(page.hasPrev === true, "paginate hasPrev");

const [q, r] = num.divmod(135, 60);
assert(q === 2 && r === 15, "divmod(135, 60)");

// 7. Formatting & Ordinals
assert(num.ordinal(1) === "1st", "ordinal(1)");
assert(num.ordinal(2) === "2nd", "ordinal(2)");
assert(num.ordinal(3) === "3rd", "ordinal(3)");
assert(num.ordinal(4) === "4th", "ordinal(4)");
assert(num.ordinal(21) === "21st", "ordinal(21)");
assert(num.ordinal(1, "fr-FR") === "1er", "ordinal(1, fr)");
assert(num.ordinal(2, "fr-FR") === "2e", "ordinal(2, fr)");

// 8. Predicates
assert(num.isEven(4) === true, "isEven(4)");
assert(num.isOdd(3) === true, "isOdd(3)");
assert(num.isInteger(42) === true, "isInteger(42)");
assert(num.isInteger(42.5) === false, "isInteger(42.5)");
assert(num.isNumeric("123.45") === true, "isNumeric('123.45')");
assert(num.isNumeric("abc") === false, "isNumeric('abc')");
assert(num.sign(-10) === -1, "sign(-10)");
assert(num.sign(10) === 1, "sign(10)");
assert(num.sign(0) === 0, "sign(0)");

// 9. Randomness
const rndInt = num.randomInt(1, 10);
assert(rndInt >= 1 && rndInt <= 10, "randomInt range");
const rndFloat = num.randomFloat(0, 1);
assert(rndFloat >= 0 && rndFloat <= 1, "randomFloat range");
const choice = num.randomChoice(["a", "b", "c"]);
assert(["a", "b", "c"].includes(choice), "randomChoice");

console.log("All NumberUtils tests passed successfully! ✅");
