import type { Response } from "../../src";

class Send {
  static success(res: Response, data: any, message = "success") {
    res.status(200).json({
      ok: true,
      message,
      data,
    });
    return;
  }

  static error(res: Response, data: any, message = "error") {
    // A generic 500 Internal Server Error is returned for unforeseen issues
    res.status(500).json({
      ok: false,
      message,
      data,
    });
    return;
  }

  static notFound(res: Response, data: any, message = "not found") {
    // 404 is for resources that don't exist
    res.status(404).json({
      ok: false,
      message,
      data,
    });
    return;
  }

  static unauthorized(res: Response, data: any, message = "unauthorized") {
    // 401 for unauthorized access (e.g., invalid token)
    res.status(401).json({
      ok: false,
      message,
      data,
    });
    return;
  }

  static validationErrors(res: Response, errors: Record<string, string[]>) {
    // 422 for unprocessable entity (validation issues)
    res.status(422).json({
      ok: false,
      message: "Validation error",
      errors,
    });
    return;
  }

  static forbidden(res: Response, data: any, message = "forbidden") {
    // 403 for forbidden access (when the user does not have the rights to access)
    res.status(403).json({
      ok: false,
      message,
      data,
    });
    return;
  }

  static badRequest(res: Response, data: any, message = "bad request") {
    // 400 for general bad request errors
    res.status(400).json({
      ok: false,
      message,
      data,
    });
    return;
  }
}

export default Send;
