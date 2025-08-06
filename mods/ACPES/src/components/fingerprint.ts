/**
 * Device fingerprinting utilities for ACPES
 */

import CryptoJS from "crypto-js";
import { Platform } from "../core/platform";
import { DeviceFingerprint } from "../types/security";

/**
 * Device fingerprinting utility class
 */
export class FingerprintUtils {
    /**
     * Generates a device fingerprint for key derivation
     */
    public static generateDeviceFingerprint(): string {
        const fingerprint: DeviceFingerprint = {
            platform: Platform.OS,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language:
                Platform.isWeb && typeof navigator !== "undefined"
                    ? navigator.language
                    : "unknown",
        };

        if (Platform.isWeb && typeof navigator !== "undefined") {
            fingerprint.userAgent = navigator.userAgent;
            fingerprint.screen = window.screen
                ? `${window.screen.width}x${window.screen.height}`
                : "unknown";
        } else if (Platform.isNode && process) {
            try {
                fingerprint.hostname = require("os").hostname();
                fingerprint.arch = process.arch;
            } catch (error) {
                // Fallback if os module is not available
                fingerprint.hostname = "unknown";
                fingerprint.arch = "unknown";
            }
        }

        return CryptoJS.SHA256(JSON.stringify(fingerprint)).toString();
    }
}

