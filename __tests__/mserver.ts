import { createServer } from "../src";
import { ms1, ms1_rpx } from "./ms1";
import { ms1_router } from "./ms1router";

const app = createServer({
    multiServer: {
        enabled: true,
        servers: [ms1],
    },
});

app.use(ms1_rpx, ms1_router);

app.start()