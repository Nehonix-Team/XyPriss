export function buildUploadArgs(uploadConf: any): string[] {
    if (!uploadConf?.enabled) return [];

    const args: string[] = [];

    if (uploadConf.destination)
        args.push("--upload-dir", uploadConf.destination);
    if (uploadConf.tempFileDir)
        args.push("--upload-temp-dir", uploadConf.tempFileDir);
    if (uploadConf.useTempFiles !== undefined)
        args.push(`--upload-use-temp-files=${uploadConf.useTempFiles}`);

    const maxFileSize = uploadConf.maxFileSize ?? uploadConf.limits?.fileSize;
    if (maxFileSize !== undefined)
        args.push("--upload-max-file-size", maxFileSize.toString());

    const maxFiles = uploadConf.maxFiles ?? uploadConf.limits?.files;
    if (maxFiles !== undefined)
        args.push("--upload-max-files", maxFiles.toString());

    if (
        Array.isArray(uploadConf.allowedMimeTypes) &&
        uploadConf.allowedMimeTypes.length > 0
    )
        args.push(
            "--upload-allowed-mimes",
            uploadConf.allowedMimeTypes.join(","),
        );

    if (uploadConf.useSubDir !== undefined)
        args.push(`--upload-use-subdir=${uploadConf.useSubDir}`);

    return args;
}
