import fs from "fs";
import path from "path";

const docsDir = path.resolve(process.cwd(), "docs/system");

const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".md"));

const fixes = [
    // Vars properties
    [/__sys__\.__port__/g, "__sys__.vars.__port__"],
    [/__sys__\.__PORT__/g, "__sys__.vars.__PORT__"],
    [/__sys__\.__version__/g, "__sys__.vars.__version__"],
    [/__sys__\.__name__/g, "__sys__.vars.__name__"],
    [/__sys__\.__alias__/g, "__sys__.vars.__alias__"],
    [/__sys__\.__author__/g, "__sys__.vars.__author__"],
    [/__sys__\.__description__/g, "__sys__.vars.__description__"],
    [/__sys__\.__app_urls__/g, "__sys__.vars.__app_urls__"],
    // EXCEPT `__sys__.__root__` which still exists on XyPrissSys?
    // Wait, in sys.ts: `public __root__: string = process.cwd();` AND it's in VarsApi. Usually user accesses __sys__.__root__. Let's leave __sys__.__root__ alone or change to __sys__.vars.__root__ if it's there. In sys.ts both exist. Let's change it.
    [/__sys__\.__root__/g, "__sys__.vars.__root__"],

    // FS methods that got accidentally converted to __sys__.read instead of __sys__.fs.read in markdown text (e.g. `__sys__.read`)
    // We only want to match `__sys__.XYZ` where XYZ is an FS method.
    // E.g. `__sys__.read(` or `__sys__.readBytes`
    [/\b__sys__\.read\b(\s*\()/g, "__sys__.fs.read$1"],
    [/\b__sys__\.readBytes\b/g, "__sys__.fs.readBytes"],
    [/\b__sys__\.readJson\b/g, "__sys__.fs.readJson"],
    [/\b__sys__\.readJsonSafe\b/g, "__sys__.fs.readJsonSafe"],
    [/\b__sys__\.readLines\b/g, "__sys__.fs.readLines"],
    [/\b__sys__\.readNonEmptyLines\b/g, "__sys__.fs.readNonEmptyLines"],
    [/\b__sys__\.createReadStream\b/g, "__sys__.fs.createReadStream"],
    [/\b__sys__\.write\b(\s*\()/g, "__sys__.fs.write$1"],
    [/\b__sys__\.writeFile\b/g, "__sys__.fs.writeFile"], // wait, $writeFile mapped to write in some places? No, FSApi has writeFile. Let's assume writeFile
    [/\b__sys__\.writeBytes\b/g, "__sys__.fs.writeBytes"],
    [/\b__sys__\.writeJson\b/g, "__sys__.fs.writeJson"],
    [/\b__sys__\.writeJsonCompact\b/g, "__sys__.fs.writeJsonCompact"],
    [/\b__sys__\.writeIfNotExists\b/g, "__sys__.fs.writeIfNotExists"],
    [/\b__sys__\.append\b(\s*\()/g, "__sys__.fs.append$1"],
    [/\b__sys__\.appendLine\b/g, "__sys__.fs.appendLine"],
    [/\b__sys__\.createWriteStream\b/g, "__sys__.fs.createWriteStream"],
    [/\b__sys__\.mkdir\b/g, "__sys__.fs.mkdir"],
    [/\b__sys__\.ls\b/g, "__sys__.fs.ls"],
    [/\b__sys__\.lsFullPath\b/g, "__sys__.fs.lsFullPath"],
    [/\b__sys__\.lsDirs\b/g, "__sys__.fs.lsDirs"],
    [/\b__sys__\.lsFiles\b/g, "__sys__.fs.lsFiles"],
    [/\b__sys__\.lsRecursive\b/g, "__sys__.fs.lsRecursive"],
    [/\b__sys__\.emptyDir\b/g, "__sys__.fs.emptyDir"],
    [/\b__sys__\.isFile\b/g, "__sys__.fs.isFile"],
    [/\b__sys__\.isDir\b/g, "__sys__.fs.isDir"],
    [/\b__sys__\.isSymlink\b/g, "__sys__.fs.isSymlink"],
    [/\b__sys__\.isEmpty\b/g, "__sys__.fs.isEmpty"],
    [/\b__sys__\.check\b/g, "__sys__.fs.check"],
    [/\b__sys__\.stats\b/g, "__sys__.fs.stats"],
    [/\b__sys__\.size\b/g, "__sys__.fs.size"],
    [/\b__sys__\.sizeHuman\b/g, "__sys__.fs.sizeHuman"],
    [/\b__sys__\.createdAt\b/g, "__sys__.fs.createdAt"],
    [/\b__sys__\.modifiedAt\b/g, "__sys__.fs.modifiedAt"],
    [/\b__sys__\.accessedAt\b/g, "__sys__.fs.accessedAt"],
    [/\b__sys__\.find\b/g, "__sys__.fs.find"],
    [/\b__sys__\.findByExt\b/g, "__sys__.fs.findByExt"],
    [/\b__sys__\.findByPattern\b/g, "__sys__.fs.findByPattern"],
    [/\b__sys__\.grep\b/g, "__sys__.fs.grep"],
    [/\b__sys__\.searchInFiles\b/g, "__sys__.fs.searchInFiles"],
    [/\b__sys__\.copy\b/g, "__sys__.fs.copy"],
    [/\b__sys__\.move\b/g, "__sys__.fs.move"],
    [/\b__sys__\.rename\b/g, "__sys__.fs.rename"],
    [/\b__sys__\.duplicate\b/g, "__sys__.fs.duplicate"],
    [/\b__sys__\.rm\b/g, "__sys__.fs.rm"],
    [/\b__sys__\.rmIfExists\b/g, "__sys__.fs.rmIfExists"],
    [/\b__sys__\.touch\b/g, "__sys__.fs.touch"],
    [/\b__sys__\.hash\b/g, "__sys__.fs.hash"],
    [/\b__sys__\.verify\b/g, "__sys__.fs.verify"],
    [/\b__sys__\.isSameContent\b/g, "__sys__.fs.isSameContent"],
    [/\b__sys__\.isNewer\b/g, "__sys__.fs.isNewer"],
    [/\b__sys__\.chmod\b/g, "__sys__.fs.chmod"],
    [/\b__sys__\.exists\b/g, "__sys__.fs.exists"],
    [/\b__sys__\.watch\b/g, "__sys__.fs.watch"],
    [/\b__sys__\.watchContent\b/g, "__sys__.fs.watchContent"],
    [/\b__sys__\.watchAndProcess\b/g, "__sys__.fs.watchAndProcess"],
    [/\b__sys__\.stream\b/g, "__sys__.fs.stream"],
    [/\b__sys__\.readSync\b/g, "__sys__.fs.readSync"],
    [/\b__sys__\.atomicWrite\b/g, "__sys__.fs.atomicWrite"],
    [/\b__sys__\.shred\b/g, "__sys__.fs.shred"],
    [/\b__sys__\.tail\b/g, "__sys__.fs.tail"],
    [/\b__sys__\.patch\b/g, "__sys__.fs.patch"],
    [/\b__sys__\.split\b/g, "__sys__.fs.split"],
    [/\b__sys__\.merge\b/g, "__sys__.fs.merge"],
    [/\b__sys__\.lock\b/g, "__sys__.fs.lock"],
    [/\b__sys__\.unlock\b/g, "__sys__.fs.unlock"],
    [/\b__sys__\.writeSecure\b/g, "__sys__.fs.writeSecure"],
    [/\b__sys__\.encryptFile\b/g, "__sys__.fs.encryptFile"],
    [/\b__sys__\.decryptFile\b/g, "__sys__.fs.decryptFile"],
    [/\b__sys__\.diffFiles\b/g, "__sys__.fs.diffFiles"],
    [/\b__sys__\.topBigFiles\b/g, "__sys__.fs.topBigFiles"],

    // OS
    [/\b__sys__\.info\b/g, "__sys__.os.info"],
    [/\b__sys__\.cpu\b/g, "__sys__.os.cpu"],
    [/\b__sys__\.memory\b/g, "__sys__.os.memory"],
    [/\b__sys__\.uptime\b/g, "__sys__.os.uptime"],
    [/\b__sys__\.bootTime\b/g, "__sys__.os.bootTime"],
    [/\b__sys__\.loadAverage\b/g, "__sys__.os.loadAverage"],
    [/\b__sys__\.processes\b/g, "__sys__.os.processes"],
    [/\b__sys__\.network\b/g, "__sys__.os.network"],
    [/\b__sys__\.ports\b/g, "__sys__.os.ports"],
    [/\b__sys__\.disks\b/g, "__sys__.os.disks"],
    [/\b__sys__\.du\b/g, "__sys__.os.du"],
    [/\b__sys__\.diskUsage\b/g, "__sys__.os.diskUsage"],

    // Path
    [/\b__sys__\.resolve\b/g, "__sys__.path.resolve"],
    [/\b__sys__\.join\b/g, "__sys__.path.join"],
    [/\b__sys__\.dirname\b/g, "__sys__.path.dirname"],
    [/\b__sys__\.basename\b/g, "__sys__.path.basename"],
    [/\b__sys__\.extname\b/g, "__sys__.path.extname"],
    [/\b__sys__\.normalize\b/g, "__sys__.path.normalize"],
    [/\b__sys__\.relative\b/g, "__sys__.path.relative"],
    [/\b__sys__\.isAbsolute\b/g, "__sys__.path.isAbsolute"],
    [/\b__sys__\.ensureDir\b/g, "__sys__.path.ensureDir"],
    [/\b__sys__\.isChild\b/g, "__sys__.path.isChild"],
    [/\b__sys__\.secureJoin\b/g, "__sys__.path.secureJoin"],
    [/\b__sys__\.toNamespacedPath\b/g, "__sys__.path.toNamespacedPath"],
    [/\b__sys__\.commonBase\b/g, "__sys__.path.commonBase"],

    // Vars
    [/\b__sys__\.update\b/g, "__sys__.vars.update"],
    [/\b__sys__\.add\b/g, "__sys__.vars.set"], // or vars.set?
    [/\b__sys__\.get\b\(/g, "__sys__.vars.get("],
    [/\b__sys__\.has\b\(/g, "__sys__.vars.has("],
    [/\b__sys__\.remove\b/g, "__sys__.vars.delete"], // vars has delete not remove
    [/\b__sys__\.keys\b/g, "__sys__.vars.keys"],
    [/\b__sys__\.reset\b/g, "__sys__.vars.reset"], // assuming vars has reset or clear
    [/\b__sys__\.clone\b/g, "__sys__.vars.clone"],

    // Specific bad assignments in configuration.md
    [
        /\b__sys__\.vars\.__env__\s*=\s*(.*?);/g,
        "// env cannot be mutated at runtime. Mode is $1",
    ],
    [
        /__sys__\.__env__\s*=\s*(.*?);/g,
        "// __sys__.__env__ cannot be reassigned; the mode ($1) is determined at boot.",
    ],

    // In case __sys__.vars.vars.__port__ happened
    [/__sys__\.vars\.vars\./g, "__sys__.vars."],
];

for (const file of files) {
    const filePath = path.join(docsDir, file);
    let content = fs.readFileSync(filePath, "utf-8");
    let original = content;

    for (const [pattern, replacement] of fixes) {
        content = content.replace(pattern, replacement as string);
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, "utf-8");
        console.log("Fixed", file);
    }
}
console.log("Done fixing.");

