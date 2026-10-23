import "../src";
import { XyPrissSys } from "../src";

(__sys__ as XyPrissSys).fs.watch(
    ".private/",
    (e) => {
        console.log("event: ", e);
    }
);

