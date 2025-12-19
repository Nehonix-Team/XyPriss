import { createServer } from "../src";


const app = createServer({
    server: {
        port: __sys__.$keys,

    },
});


__sys__.__ENV__.set("author", "Nehonix");
__sys__.__ENV__.set("version", "1.0.0");
console.log(__sys__.author);
console.log(__sys__.$isProduction());
console.log(__sys__.version);


app.start();



