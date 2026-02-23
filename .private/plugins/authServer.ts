import { MultiServerConfig } from "../../src";

export const authVaultBasePath = "auth.server";
/***
 * Ce serveur est le serveur principal de l'application.
 * Il est responsable de la gestion des routes principales de l'application.
 */
export const authServer: MultiServerConfig = {
  id: "server.mynehosell.auth.nehonix.com", // url de production qui sera géré par le pluggin XynGinc
  plugins: {
  },
  routePrefix: "/api/auth/",
  port: Number((__sys__ as any).__env__.get("PORT")) || (__sys__.__PORT__ as number),
  server: {
    xems: {
      enable: true,
      // persistence: {
      //   enabled: true,
      //   secret: __sys__.__env__.get("XEMS_PERSIST_SECRET_KEY")!,
      //   path: authVaultBasePath + ".xvault.xems", // fichier de persistance pour le serveur d'authentification
      // },
    },
  },
};
