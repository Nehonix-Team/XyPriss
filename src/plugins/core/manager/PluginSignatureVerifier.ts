/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************** */

import * as crypto from "node:crypto";
import type { XyPrissPlugin } from "../../types/PluginTypes";
import { Logger } from "../../../shared/logger";

/**
 * Plugin Signature Verifier
 * Implements Ed25519 verification for plugin Zero-Trust security.
 */
export class PluginSignatureVerifier {
    // Nehonix Framework Public Key (PoC Root Key)
    private static readonly FRAMEWORK_PUBLIC_KEY_DER = Buffer.from(
        "302a300506032b6570032100b2bd9a87bd889c5586f010cb71a3415a7e1df557a94b92c640a763b3495b8cfd",
        "hex",
    );

    /**
     * Verify if a plugin has a valid cryptographic signature.
     */
    public static verify(plugin: XyPrissPlugin, logger: Logger): boolean {
        if (!plugin.signature) {
            return false;
        }

        try {
            // Data to verify: name + version + root (pinned to location if available)
            // Note: __root__ might be empty during early registration if discovery hasn't run.
            // But verifyContract runs before this, so __root__ should be populated.
            const data = `${plugin.name}:${plugin.version}:${plugin.__root__ || ""}`;
            const signatureBuffer = Buffer.from(plugin.signature, "hex");

            // Create KeyObject from DER
            const publicKey = crypto.createPublicKey({
                key: this.FRAMEWORK_PUBLIC_KEY_DER,
                format: "der",
                type: "spki",
            });

            return crypto.verify(
                undefined, // Algorithm is inferred for Ed25519 KeyObjects
                Buffer.from(data),
                publicKey,
                signatureBuffer,
            );
        } catch (error) {
            logger.error(
                "plugins",
                `Signature verification failed for ${plugin.name}:`,
                error,
            );
            return false;
        }
    }
}

