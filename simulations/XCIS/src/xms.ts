import { XyphraPlugin } from "xyphra";
import { MultiServerConfig } from "xypriss";

export const xms: MultiServerConfig = {
    id: "xms",
    port: 1829,
     plugins: {
            register: [
                XyphraPlugin({
                    anonymizeIp: true,
                    immediate: false,
                    stream: {
                        write(str: string) {
                            console.log(str);
                        },
                    },
                }),
            ],
        },
};
