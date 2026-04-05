export function create() {
    console.log("Stack inside lib.ts:");
    console.log(new Error().stack);
}
export function factory(fn: any) {
    return (config: any) => {
        return fn(config);
    };
}

