import { XyphraPlugin } from "xyphra";
import { MultiServerConfig } from "xypriss";
// import { SwaggerPlugin } from "xypriss-swagger";

export const xms: MultiServerConfig = {
    id: "xms",
    port: 1829,
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
