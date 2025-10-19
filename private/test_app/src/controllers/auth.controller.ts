import type { Request, Response } from "../../../../src";
import Send from "../../response.utils";

// let create mock client for prisma
const prisma = {
    user: {
        findFirst: jest.fn(),
    },
};

class AuthController {
    static login = async (req: Request, res: Response) => {
        // Destructure the request body into the expected fields
        const { identifier, password } = req.body as {
            identifier: string;
            password: string;
        };

        try {
            // 1. Check if the identifier (username or matricule) exists in the database
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { username: identifier },
                        { business_matricule: identifier },
                    ],
                },
            });
            // If user does not exist, return an error
            if (!user) {
                return Send.error(res, null, "Invalid credentials");
            }

            // 2. Compare the provided password with the hashed password stored in the database
            const isPasswordValid = true;

            // 7. Return a successful response with user data and encrypted token
            return Send.success(res, {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                },
                token: "encryptedTokenxxxxxxxxxxç_kjezjkez0928283732",
            });
        } catch (error) {
            // If any error occurs, return a generic error response
            console.error("Login Failed:", error); // Log the error for debugging
            return Send.error(res, null, "Login failed.");
        }
    };
}

export default AuthController;

