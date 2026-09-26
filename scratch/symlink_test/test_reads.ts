import fs from "node:fs";
import path from "node:path";

const targetPath = path.join(__dirname, ".env");

console.log("=== TEST DE LECTURE DU FICHIER .env ===");
console.log("Chemin ciblé :", targetPath);

// 1. Stat du fichier
const lstat = fs.lstatSync(targetPath);
console.log("\n1. Est-ce un lien symbolique (lstat) ? ->", lstat.isSymbolicLink());
if (lstat.isSymbolicLink()) {
    console.log("   Cible réelle du lien (readlink)   ->", fs.readlinkSync(targetPath));
}

// 2. Lecture standard (ce que font 99.9% des modules/binaires : open / read)
const content = fs.readFileSync(targetPath, "utf-8");
console.log("\n2. Contenu retourné lors d'une lecture standard (fs.readFileSync / open) :");
console.log("--------------------------------------------------");
console.log(content.trim());
console.log("--------------------------------------------------");
