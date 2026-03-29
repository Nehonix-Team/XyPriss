import "../src";
import { XyPrissSys } from "../src";

(__sys__ as XyPrissSys).$watch(
    "/home/idevo/Documents/projects/XyPriss/.private/",
    (e) => {
        console.log("event: ", e);
    }
);

