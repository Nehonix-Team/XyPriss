/**
 * XyPriss Default Server Configuration
 *
 * Configured for a standard, single-instance server operation.
 */

import { __sys__ } from "xypriss";
import { manifest } from "./manifest";

export const serverConfigs: ServerOptions = {
  /**
   * Standard single-server configuration.
   * Configured for high-performance standalone operation.
   */
  server: {
      autoKillConflict: true,
      port: __sys__.vars.__port__,
      serviceName: manifest.name,
  },

};
