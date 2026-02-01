import { MultiServerConfig } from "../src";
export const ms1_rpx = "/server/ms1";

export const ms1: MultiServerConfig = {
    id: "ms1",
    routePrefix: ms1_rpx,
    port: 5489,
    plugins: {
        register: [],
    },
};

