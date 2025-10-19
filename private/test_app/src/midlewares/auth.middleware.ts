import type { NextFunction, Request, Response } from "../../../../src";

export interface DecodedToken {
    userId: number;
}

class AuthMiddleware {
    /**
     * Middleware to authenticate the user based on the access token stored in the HttpOnly cookie.
     * This middleware will verify the access token and attach the user information to the request object.
     */
    static authenticateUser = (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        // 1. Extract the encrypted token from the Authorization header
        return res.status(401).json({ message: "unauthorize: test" });
        // Proceed to the next middleware or route handler
        // next();
    };
}

export default AuthMiddleware;

