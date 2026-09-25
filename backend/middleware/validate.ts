import { Request, Response, NextFunction } from 'express';

interface ZodLikeError {
    issues?: Array<{ path: (string | number)[]; message: string }>;
}

// duck-typed so it works even if the schema comes from a second copy of zod
// (shared's dist/schemas bundles its own instance).
type ZodSchemaLike = {
    safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: ZodLikeError };
};

export const validate = (schema: ZodSchemaLike) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const issues = (result.error?.issues ?? []).map(
                (issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`
            );
            res.status(400).json({
                success: false,
                message: 'Validation failed.',
                details: issues,
            });
            return;
        }
        req.body = result.data;
        next();
    };
};