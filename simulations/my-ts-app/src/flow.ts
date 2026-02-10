import { defineFlow } from "fractostate";

const flx = defineFlow(
    "counter",
    {},
    {
        actions: {
            __ctx__(c) {
                console.log("state: ", c.state);
            },

            inc: (ops) => (c) => {
                ops.state.self._set(c.state.self._value + 1);
            },
        },
    },
);

