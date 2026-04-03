import { XyPrissApp, ServerOptions } from "../../types/types";
import { FileUploadManager } from "../components/fastapi/upload/FileUploadManager";

export class UploadManager {
    constructor(
        private app: XyPrissApp,
        private options: ServerOptions,
        private refs: {
            fileUploadManager: FileUploadManager;
            initPromise: Promise<void>;
        },
    ) {}

    public initializeFileUploadMethodsSync(): void {
        this.app.uploadSingle = (fieldname: string) => {
            return async (req: any, res: any, next: any) => {
                if (this.refs.fileUploadManager?.isEnabled()) {
                    return this.refs.fileUploadManager.single(fieldname)(
                        req,
                        res,
                        next,
                    );
                }
                if (this.options.fileUpload?.enabled) {
                    await this.refs.initPromise;
                    if (this.refs.fileUploadManager?.isEnabled()) {
                        return this.refs.fileUploadManager.single(fieldname)(
                            req,
                            res,
                            next,
                        );
                    }
                }
                next(
                    new Error(
                        "File upload not enabled. Set fileUpload.enabled to true in server options.",
                    ),
                );
            };
        };

        this.app.uploadArray = (fieldname: string, maxCount?: number) => {
            return async (req: any, res: any, next: any) => {
                if (this.refs.fileUploadManager?.isEnabled()) {
                    return this.refs.fileUploadManager.array(
                        fieldname,
                        maxCount,
                    )(req, res, next);
                }
                if (this.options.fileUpload?.enabled) {
                    await this.refs.initPromise;
                    if (this.refs.fileUploadManager?.isEnabled()) {
                        return this.refs.fileUploadManager.array(
                            fieldname,
                            maxCount,
                        )(req, res, next);
                    }
                }
                next(
                    new Error(
                        "File upload not enabled. Set fileUpload.enabled to true in server options.",
                    ),
                );
            };
        };

        this.app.uploadFields = (fields: any[]) => {
            return async (req: any, res: any, next: any) => {
                if (this.refs.fileUploadManager?.isEnabled()) {
                    return this.refs.fileUploadManager.fields(fields)(
                        req,
                        res,
                        next,
                    );
                }
                if (this.options.fileUpload?.enabled) {
                    await this.refs.initPromise;
                    if (this.refs.fileUploadManager?.isEnabled()) {
                        return this.refs.fileUploadManager.fields(fields)(
                            req,
                            res,
                            next,
                        );
                    }
                }
                next(
                    new Error(
                        "File upload not enabled. Set fileUpload.enabled to true in server options.",
                    ),
                );
            };
        };

        this.app.uploadAny = () => {
            return async (req: any, res: any, next: any) => {
                if (this.refs.fileUploadManager?.isEnabled()) {
                    return this.refs.fileUploadManager.any()(req, res, next);
                }
                if (this.options.fileUpload?.enabled) {
                    await this.refs.initPromise;
                    if (this.refs.fileUploadManager?.isEnabled()) {
                        return this.refs.fileUploadManager.any()(
                            req,
                            res,
                            next,
                        );
                    }
                }
                next(
                    new Error(
                        "File upload not enabled. Set fileUpload.enabled to true in server options.",
                    ),
                );
            };
        };

        (this.app as any).upload = null;
    }
}

