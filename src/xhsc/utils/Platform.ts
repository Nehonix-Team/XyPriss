/**
 * **Platform — XyPriss Platform & Architecture Utilities**
 *
 * Provides normalized naming conventions for OS and CPU architectures
 * used throughout the XyPriss ecosystem, specifically for binary resolution.
 */
export class Platform {
    /**
     * **Get Normalized OS Part**
     *
     * Maps Node.js process.platform to XyPriss standard OS identifiers.
     * @returns {'windows' | 'darwin' | 'linux'}
     */
    public static getOsPart(): string {
        switch (process.platform) {
            case "win32":
                return "windows";
            case "darwin":
                return "darwin";
            default:
                return "linux";
        }
    }

    /**
     * **Get Normalized Architecture Part**
     *
     * Maps Node.js process.arch to XyPriss standard architecture identifiers.
     * @returns {'arm64' | 'amd64'}
     */
    public static getArchPart(): string {
        switch (process.arch) {
            case "arm64":
                return "arm64";
            default:
                return "amd64"; // Default to amd64/x64
        }
    }

    /**
     * **Get Binary Suffix**
     *
     * Returns '.exe' for Windows platforms, empty string otherwise.
     */
    public static getBinarySuffix(): string {
        return process.platform === "win32" ? ".exe" : "";
    }
}
