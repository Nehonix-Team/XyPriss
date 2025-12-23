export const testSConfigs: ServerOptions = __const__.$make({
    notFound: {
        message: "this is a test not found msg",
    },
    security: {
        rateLimit: {
            max: 7,
            legacyHeaders: true,
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

