import { Interface } from "reliant-type";
import { IXStaticSchem } from "./IXStaticSchem";

export type DotfileModeT = "deny" | "allow";

/**
 * How to handle files starting with a dot (e.g. .env, .git).
 * - "allow": Serves the file (Security Risk)
 * - Object: Custom restricted file patterns.
 * @default "deny"
 */
type dotfiles =
    | DotfileModeT
    | {
          mode: DotfileModeT;
          /** Custom file patterns to always restrict regardless of dot prefix */
          custom?: string[];
      };

/**
 * Static file serving configuration (XStatic).
 *
 * Configures the high-performance XStatic engine, including
 * meta-caching and delegation behaviors.
 */
export type IXStatic = typeof IXStaticSchem.types & {
    dotfiles?: dotfiles;
};


export interface StaticOptions {
    /** Allow serving files outside of the project root (Security Risk) */
    allowOutsideRoot?: boolean;
    /** Disable path validation safety checks */
    unsafe?: boolean;
    /** Cache-Control max-age header */
    maxAge?: string | number;
    /** Fallback to standard TS streaming if delegation fails */
    fallback?: boolean;
}