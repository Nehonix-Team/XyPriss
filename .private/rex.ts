import { Interface, Mod } from "reliant-type";

const i1 = Interface({
    name: "string",
});
const i2 = Interface({
    age: "number",
});

const i3 = Interface({
    location: "string",
    version: "semver",
});

// const xs = Mod.

console.log(xs.types);

const data: typeof xs.types = {
    
};

