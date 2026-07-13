import { XyphraPlugin } from "xyphra";
import { MultiServerConfig } from "xypriss";
// import { SwaggerPlugin } from "xypriss-swagger";

export const xms: MultiServerConfig = {
    id: "xms",
    port: 8085,
    security: {
        cors: {
            origin: [/^http:\/\/127.0.0.1:5500/],
            // allowedHeaders: [],
        },
        csrf: {
            enabled: true,
            trustedOrigins: [/^http:\/\/127.0.0.1:5500/], //http://127.0.0.1/
            cookieName: "csrf-token",
            doubleSubmitCookie: true,
            cookieOptions: {
                secure: false,
                sameSite: "lax",
                httpOnly: false,
            },
        },
    },
    // responseManipulation: {
    //     enabled: true,
    //     maxDepth: 10,
    //     rules: [
    //         // 1. Stack trace multi-lignes, on garde le début (déjà validé chez toi)
    //         {
    //             valuePattern: /database error:[\s\S]*?failed at line/gis,
    //             preserve: 15,
    //         },

    //         // 2. Champ exact + remplacement fixe
    //         {
    //             field: "secretKey",
    //             replacement: "[REDACTED]",
    //         },

    //         // 3. Field-regex : toute clé qui ressemble à un secret, peu importe la casse
    //         //    (password, Password, apiToken, API_TOKEN, secretValue, ...)
    //         {
    //             field: /password|token|secret|apikey|api_key/i,
    //             preserve: 0,
    //         },

    //         // 4. Dot-path explicite vers un champ profondément imbriqué
    //         {
    //             field: "database.credentials.password",
    //             replacement: "[DB_PASSWORD_HIDDEN]",
    //         },

    //         // 5. ValuePattern SANS field : masque n'importe quelle valeur qui MATCHE,
    //         //    quel que soit le nom de la clé -> détecte un JWT partout où il traîne
    //         {
    //             valuePattern:
    //                 /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    //             preserve: 10,
    //         },

    //         // 6. Email : on garde le préfixe utilisateur, on masque le reste
    //         {
    //             field: /email/i,
    //             valuePattern:
    //                 /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
    //             preserve: 4,
    //         },

    //         // 7. Carte bancaire : pattern générique 13-19 chiffres avec espaces/tirets optionnels
    //         {
    //             field: "number",
    //             valuePattern: /^[0-9](?:[0-9 -]{11,22})[0-9]$/,
    //             replacement: "[CARD_REDACTED]",
    //         },

    //         // 8. IP : preserve les 2 premiers octets, masque le reste
    //         {
    //             field: "clientIp",
    //             valuePattern: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    //             preserve: 4,
    //         },

    //         // 9. Clés Stripe-like dans un tableau d'objets (valeur globale, sans field)
    //         {
    //             valuePattern: /^sk_(live|test)_[A-Za-z0-9]{16,}$/,
    //             preserve: 8,
    //         },
    //     ],
    // },
    plugins: {
        register: [
            // XyphraPlugin({
            //     anonymizeIp: true,
            //     immediate: false,
            //     stream: {
            //         write(str: string) {
            //             console.log(str);
            //         },
            //     },
            // }),
            // SwaggerPlugin({
            //     path: "/docs",
            //     port: 7070,
            //     title: "XCIS API Docs"
            // }),
        ],
    },
};

