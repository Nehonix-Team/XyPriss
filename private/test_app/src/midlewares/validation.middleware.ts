import type { Request, Response, NextFunction } from "../../../../src";
import { type InterfaceSchema } from "fortify-schema";

class ValidationMiddleware {
    static validateBody(schema: InterfaceSchema) {
        // console.log("schema: ", schema);
        return (req: Request, res: Response, next: NextFunction) => {
            const result = schema.safeParse(req.body);
            if (result.success) {
                next();
            } else {
                // Format errors like { email: ['error1', 'error2'], password: ['error1'] }
                const formattedErrors: Record<string, string[]> = {};

                result.errors.forEach((err) => {
                    const field = err.path.join("."); // Get the field name
                    if (!formattedErrors[field]) {
                        formattedErrors[field] = [];
                    }
                    formattedErrors[field].push(err.message); // Add validation message
                });

                return res.status(400).json({ formattedErrors });
            }
        };
    }
}

export default ValidationMiddleware;

