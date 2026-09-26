import fs from "fs";
import path from "path";

const docsDir = path.resolve(process.cwd(), "docs/system");
const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".md"));

const replacements = [
    [/__sys__\.\$watch\(/g, "__sys__.fs.watch("],
    [/__sys__\.\$watchContent/g, "__sys__.fs.watchContent"],
    [/__sys__\.\$watchAndProcess/g, "__sys__.fs.watchAndProcess"],
    [/__sys__\.\$stream/g, "__sys__.fs.stream"],
    [/__sys__\.\$readSync/g, "__sys__.fs.readSync"],
    [/__sys__\.\$diskUsage/g, "__sys__.os.diskUsage"],
    [/__sys__\.\$atomicWrite/g, "__sys__.fs.atomicWrite"],
    [/__sys__\.\$shred/g, "__sys__.fs.shred"],
    [/__sys__\.\$tail/g, "__sys__.fs.tail"],
    [/__sys__\.\$patch/g, "__sys__.fs.patch"],
    [/__sys__\.\$split/g, "__sys__.fs.split"],
    [/__sys__\.\$merge/g, "__sys__.fs.merge"],
    [/__sys__\.\$lock/g, "__sys__.fs.lock"],
    [/__sys__\.\$unlock/g, "__sys__.fs.unlock"],
    [/__sys__\.\$isChild/g, "__sys__.path.isChild"],
    [/__sys__\.\$secureJoin/g, "__sys__.path.secureJoin"],
    [/__sys__\.\$metadata/g, "__sys__.fs.metadata"], // usually fs or path, let's say fs
    [/__sys__\.\$toNamespacedPath/g, "__sys__.path.toNamespacedPath"],
    [/__sys__\.\$commonBase/g, "__sys__.path.commonBase"],
    [/__sys__\.\$wp\(/g, "__sys__.fs.wp("],
    [/__sys__\.\$wap\(/g, "__sys__.fs.wap("],
    [/__sys__\.\$wcp\(/g, "__sys__.fs.wcp("],
    [/__sys__\.\$wc\(/g, "__sys__.fs.wc("],
    [/__sys__\.\$writeSecure/g, "__sys__.fs.writeSecure"],
    [/__sys__\.\$encryptFile/g, "__sys__.fs.encryptFile"],
    [/__sys__\.\$decryptFile/g, "__sys__.fs.decryptFile"],
    [/__sys__\.\$diffFiles/g, "__sys__.fs.diffFiles"],
    [/__sys__\.\$topBigFiles/g, "__sys__.fs.topBigFiles"],
];

for (const file of files) {
    const filePath = path.join(docsDir, file);
    let original = fs.readFileSync(filePath, "utf-8");
    let content = original;

    for (const [pattern, replacement] of replacements) {
        content = content.replace(pattern, replacement as string);
    }

    if (content !== original) {
        console.log("Updated", file);
        fs.writeFileSync(filePath, content, "utf-8");
    }
}
console.log("Docs migration cleanup complete!");

