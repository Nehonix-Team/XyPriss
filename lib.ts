export function create() {
    console.log("Stack inside lib.ts:");
    console.log(new Error().stack);
}
export function factory(fn) {
    return (config) => {
        return fn(config);
    };
}
