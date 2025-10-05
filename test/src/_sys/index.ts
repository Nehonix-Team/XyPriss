import { argv } from "process";
import { createServer } from "xypriss";
import { fObject } from "xypriss-security";

export const _sys = {
    __version: "1.0.0",
    __author: "Nehonix",
    __app_urls: {},
    __name: "XyPriss", 
    __alias: "XyP",
    __port: parseInt(process.env["PORT"] || "8739"),
    __env: (process.env["NODE_ENV"] || "development") as ENV["env"],
};

export type ENV = NonNullable<Parameters<typeof createServer>[0]>;

