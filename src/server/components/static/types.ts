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

