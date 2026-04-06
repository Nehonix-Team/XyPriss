/**
 * Interface representing the result of a system command response from xhsc.
 */
export interface CommandResult<T = any> {
    status: "ok" | "error";
    data?: T;
    message?: string;
}

