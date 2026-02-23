import { NextFunction, Request, Response } from "../../src";

export const testAuthMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    console.log("Logged in successfully via testAuthMiddleware");
    next();
};

