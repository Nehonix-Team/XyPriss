import { create, factory } from "./lib";
export const MyPlugin = factory((config: any) => {
    return create();
});

