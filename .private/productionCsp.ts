export const productionCSP = {
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          blockAllMixedContent: [],

          fontSrc: ["'self'", "https:", "data:"],

          frameAncestors: [
            "'self'",
            "https://accounts.google.com/",
            "https://dll.nehonix.com",
            "https://nehosell.com",
            "https://api.nehosell.com",
            "https://nehonix.com",
          ],
          frameSrc: [
            "'self'",
            "https://accounts.google.com/",
            "https://dll.nehonix.com",
            "https://nehosell.com",
            "https://api.nehosell.com",
            "https://nehonix.com",
          ],

          imgSrc: ["'self'", "data:"],

          objectSrc: ["'self'", "blob:"],

          mediaSrc: ["'self'", "blob:", "data:"],

          scriptSrc: ["'self'", "https://apis.google.com"],
          scriptSrcAttr: ["'none'"],

          // ---- CONTINUATION FROM THE SECOND IMAGE ----

          styleSrc: ["'self'", "https:", "'unsafe-inline'"],

          upgradeInsecureRequests: [],

          connectSrc: ["'self'", "https://api.nehosell.com"],
        },
      },
    },
  },
};
