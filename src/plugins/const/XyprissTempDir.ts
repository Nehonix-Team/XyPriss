import path from "path";
import os from "os";
import fs from "fs";

export const XyprissTempDir = path.join(os.tmpdir(), "nehonix.xypriss.data");

export function createXyprissTempDir(_path: string): string {
    const normalisedPath = path.join(XyprissTempDir, _path);
    if (!fs.existsSync(normalisedPath)) {
        fs.mkdirSync(normalisedPath, { recursive: true });
    }
    return normalisedPath;
}

