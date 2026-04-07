import { ISwaggerJSONStructure } from "../types";

console.log("[PLUGIN:META] 🥸 la 'root' du plugin: ", __sys__?.__root__);

const root = __sys__.__root__;

export const meta = __sys__.fs.readJsonSync(
    __sys__.fs.join(root, "package.json"),
) as ISwaggerJSONStructure;

export const toPascalCase = (str: string, spliter = "-") =>
    str
        .split(spliter)
        .map((n) => n[0].toUpperCase() + n.slice(1))
        .join(" ");

