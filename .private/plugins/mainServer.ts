import { serv_host } from "@/configs/host.conf";
import { logger } from "@/plugins/logger";
import { MultiServerConfig } from "xypriss";

export const mainVaultBasePath = "main.server";
/***
 * Ce serveur est le serveur principal de l'application.
 * Il est responsable de la gestion des routes principales de l'application.
 */
export const mainServer: MultiServerConfig = {
  id: "server.mynehosell.main.nehonix.com", // url de production qui sera géré par le pluggin XynGinc
  plugins: {
    register: [logger],
  },
  routePrefix: "/api/v1",
  port: Number(__sys__.__env__.get("PORT")) || (__sys__.__PORT__ as number),
  host: serv_host,
  server: {
    xems: {
      enable: true,
      persistence: {
        enabled: true,
        secret: __sys__.__env__.get("XEMS_PERSIST_SECRET_KEY")!,
        path: mainVaultBasePath + ".xvault.xems",
      },
    },
  },
};
