export const testSConfigs: ServerOptions = __const__.$make({
    security: {
        rateLimit: {
            max: 7,
            message: "this is a test rtlm msg",
        },
    },
});

export const testSConfigs2: ServerOptions = {
    security: {
        rateLimit: __const__.$make({
            max: 2,
            message: "this is a test rtlm msg for server 2",
        }),
    },
};

