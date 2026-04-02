import "xypriss";
import { ISwaggerJSONStructure } from "../types";

export const meta = __sys__.fs.readJsonSync(
    __sys__.fs.join(__sys__.__root__, "package.json"),
) as ISwaggerJSONStructure;

export const toPascalCase = (str: string, spliter = "-") =>
    str
        .split(spliter)
        .map((n) => n[0].toUpperCase() + n.slice(1))
        .join(" ");

