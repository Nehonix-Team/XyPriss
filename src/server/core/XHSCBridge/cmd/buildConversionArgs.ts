/**
 * buildConversionArgs - Build CLI arguments for native data conversion.
 */
export function buildConversionArgs(config: any): string[] {
    if (!config || config.enabled === false) {
        return [];
    }

    const args: string[] = ["--conversion-enabled"];

    if (config.xmlToJson) {
        args.push("--conv-xml-json");
    }

    if (config.attributePrefix) {
        args.push("--conv-attr-prefix", config.attributePrefix);
    }

    if (config.textContentKey) {
        args.push("--conv-text-key", config.textContentKey);
    }

    if (config.maxConversionSize) {
        args.push("--conv-max-size", String(config.maxConversionSize));
    }

    if (config.autoReplyFormat) {
        args.push("--conv-auto-reply");
    }

    return args;
}
