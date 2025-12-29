export default [
    {
        name: "Architecture",
        handler: async () => {
            return (await import("./t")).default;
        },
    },
];