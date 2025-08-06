/**
 * Mobile platform storage implementation for CPESS
 * Uses React Native Keychain for secure storage
 */

import { SecureStorageOptions } from "../types/options";
import { PlatformModules } from "../core/platform";
import { DEFAULT_CONFIG } from "../utils/constants";

/**
 * Mobile storage implementation using React Native Keychain
 */
export class MobileStorage {
    /**
     * Store data in mobile keychain
     */
    async setItem(
        key: string,
        data: string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        if (!PlatformModules.Keychain) {
            throw new Error("Keychain module not available");
        }

        const keychainOptions = {
            accessControl: options.touchID
                ? PlatformModules.Keychain.ACCESS_CONTROL.BIOMETRY_ANY
                : undefined,
            accessible:
                PlatformModules.Keychain.ACCESSIBLE
                    .WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            authenticatePrompt: options.requireAuth
                ? "Authentication required"
                : undefined,
            showModal: options.showModal,
        };

        await PlatformModules.Keychain.setInternetCredentials(
            options.service || DEFAULT_CONFIG.DEFAULT_SERVICE,
            key,
            data,
            keychainOptions
        );
        return true;
    }

    /**
     * Retrieve data from mobile keychain
     */
    async getItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<string | null> {
        if (!PlatformModules.Keychain) {
            return null;
        }

        const credentials =
            await PlatformModules.Keychain.getInternetCredentials(
                options.service || DEFAULT_CONFIG.DEFAULT_SERVICE
            );

        if (credentials && credentials.username === key) {
            return credentials.password;
        }
        return null;
    }

    /**
     * Remove data from mobile keychain
     */
    async removeItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        if (!PlatformModules.Keychain) {
            return false;
        }

        await PlatformModules.Keychain.resetInternetCredentials(
            options.service || DEFAULT_CONFIG.DEFAULT_SERVICE
        );
        return true;
    }

    /**
     * Clear all data from mobile keychain
     */
    async clear(): Promise<boolean> {
        if (!PlatformModules.Keychain) {
            return false;
        }

        await PlatformModules.Keychain.resetInternetCredentials(
            DEFAULT_CONFIG.DEFAULT_SERVICE
        );
        return true;
    }
}

