export interface FileUploadConfig {
    /** Enable file upload handling */
    enabled?: boolean;

    /** Maximum file size in bytes */
    maxFileSize?: number;

    /** Maximum number of files per request */
    maxFiles?: number; 

    /** Allowed MIME types */
    allowedMimeTypes?: string[];

    /** Allowed file extensions */
    allowedExtensions?: string[];

    /** Upload destination directory */
    destination?: string;

    /** Custom filename function */
    filename?: (req: any, file: any, callback: (error: Error | null, filename: string) => void) => void;

    /** Detailed limits configuration */
    limits?: {
        /** Max field name size in bytes */
        fieldNameSize?: number;

        /** Max field value size in bytes */
        fieldSize?: number;

        /** Max number of non-file fields */
        fields?: number;

        /** Max file size in bytes */
        fileSize?: number;

        /** Max number of file fields */
        files?: number;

        /** Max number of header key=>value pairs */
        headerPairs?: number;
    };

    /** Preserve full paths instead of just filenames */
    preservePath?: boolean;

    /** Custom file filter function */
    fileFilter?: (req: any, file: any, callback: (error: Error | null, acceptFile: boolean) => void) => void;

    /** Storage type */
    storage?: 'disk' | 'memory' | 'custom';

    /** Create parent directories if they don't exist */
    createParentPath?: boolean;

    /** Abort request on limit reached */
    abortOnLimit?: boolean;

    /** Response message when limit is reached */
    responseOnLimit?: string;

    /** Use temporary files for large uploads */
    useTempFiles?: boolean;

    /** Temporary file directory */
    tempFileDir?: string;

    /** Parse nested objects in multipart data */
    parseNested?: boolean;

    /** Enable debug logging */
    debug?: boolean;

    /** Custom multer options */
    multerOptions?: {
        dest?: string;
        storage?: any;
        limits?: {
            fieldNameSize?: number;
            fieldSize?: number;
            fields?: number;
            fileSize?: number;
            files?: number;
            headerPairs?: number;
        };
        preservePath?: boolean;
        fileFilter?: (req: any, file: any, callback: (error: Error | null, acceptFile: boolean) => void) => void;
        [key: string]: any;
    };
}