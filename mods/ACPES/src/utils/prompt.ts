/**
 * Terminal prompt utilities for Node.js authentication
 */

import { Logger } from "../../../../shared/logger";

/**
 * Terminal prompt utility for Node.js authentication
 */
export class TerminalPrompt {
    private static logger: Logger;

    /**
     * Initialize the prompt utility
     */
    private static initialize(): void {
        if (!this.logger) {
            this.logger = new Logger({
                components: {
                    acpes: true,
                },
            });
        }
    }

    /**
     * Show authentication prompt in terminal (Node.js only)
     */
    public static async showAuthenticationPrompt(
        message: string = "Authentication required to access secure data"
    ): Promise<boolean> {
        this.initialize();

        // Only available in Node.js environment
        if (typeof process === "undefined" || typeof require === "undefined") {
            this.logger.warn(
                "acpes",
                "Terminal prompt not available in this environment"
            );
            return true; // Default to allow access
        }

        try {
            // Dynamic import for Node.js readline
            const readline = await import("readline");

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            this.logger.info("acpes", "Showing authentication prompt");

            return new Promise((resolve) => {
                rl.question(
                    "Would you like to authenticate to access secure data (yes/no): ",
                    (answer) => {
                        rl.close();

                        const isAuthenticated =
                            answer.toLowerCase().trim() === "yes";

                        if (isAuthenticated) {
                            this.logger.info(
                                "acpes",
                                "User authenticated successfully"
                            );
                        } else {
                            this.logger.warn(
                                "acpes",
                                "User authentication failed"
                            );
                        }

                        resolve(isAuthenticated);
                    }
                );
            });
        } catch (error) {
            this.logger.error(
                "acpes",
                "Error showing authentication prompt:",
                error
            );
            return true; // Default to allow access on error
        }
    }
}

