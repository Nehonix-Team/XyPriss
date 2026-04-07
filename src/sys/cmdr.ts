/**
 * Interface representing the result of a system command response from xsys.
 */
export interface CommandResult<T = any> {
    status: "ok" | "error";
    data?: T;
    message?: string;
}

