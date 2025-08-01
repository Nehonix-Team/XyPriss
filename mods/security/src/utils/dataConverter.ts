import { __processor__ } from "nehonix-uri-processor";
import { EncodingHashType } from "../types";
import {
    bufferToBase64,
    bufferToHex,
    bufferToBase58,
    bufferToBase64Url,
    bufferToBinary,
    bufferToString,
} from ".";

type EncryptOptions = {
    onError?: (error: any) => void;
    onBuffer?: (buffer: Uint8Array<ArrayBufferLike>) => void;
    onResult?: (result: string) => void;
};

export function bufferDataConverter(
    input: Uint8Array<ArrayBufferLike>,
    outputFormat: EncodingHashType,
    options: EncryptOptions = {}
): string | null {
    const { onError, onBuffer, onResult } = options;

    try {
        let result: string | null = null;

        switch (outputFormat) {
            case "hex":
                result = bufferToHex(input);
                onResult?.(result);
                break;
            case "base64":
                result = bufferToBase64(input);
                onResult?.(result);
                break;
            case "base58":
                result = bufferToBase58(input);
                onResult?.(result);
                break;
            case "binary":
                result = bufferToBinary(input);
                onResult?.(result);
                break;
            case "buffer":
                result = null;
                onBuffer?.(input);
                break;
            case "base64url":
                result = bufferToBase64Url(input);
                onResult?.(result);
                break;
            case "utf8":
                result = bufferToString(input);
                onResult?.(result);
                break;
            default:
                try {
                    // Convert Uint8Array to string for processor.encode()
                    // Since processor.encode expects a string input, we need to convert binary data to string first
                    let inputString: string;

                    // Try UTF-8 decoding first (best for text data)
                    try {
                        inputString = new TextDecoder("utf-8", {
                            fatal: true,
                        }).decode(input);
                    } catch {
                        // If UTF-8 decoding fails (binary data), convert to Base64 first
                        // This ensures the processor gets valid string input
                        inputString = bufferToBase64(input);
                    }

                    result = __processor__.encode(inputString, outputFormat);
                    onResult?.(result);
                } catch (error) {
                    onError?.(error);
                    throw error;
                }
                break;
        }

        return result;
    } catch (error) {
        onError?.(error);
        throw error;
    }
}

