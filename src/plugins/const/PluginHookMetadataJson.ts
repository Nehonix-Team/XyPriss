// convert into json

import { XStringify } from "xypriss-security";
import { HOOK_METADATA } from "./PluginHookIds";

export const PluginHookMetadataJson = XStringify(HOOK_METADATA);

console.log(PluginHookMetadataJson);

