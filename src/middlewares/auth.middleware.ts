import { Request, Response, NextFunction } from "express";
import { auth } from "../config/auth";

// Extend Express Request interface to include the session and user object natively
declare global {
  namespace Express {
    interface Request {
      session?: typeof auth.$Infer.Session.session;
      user?: typeof auth.$Infer.Session.user;
    }
  }
}

/**
 * Middleware to ensure the incoming request comes from an authenticated user.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Convert Express IncomingHttpHeaders to a Web standard Headers object
    const webHeaders = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => webHeaders.append(key, v));
      } else if (value !== undefined) {
        webHeaders.set(key, value);
      }
    });

    // Pass the standard Web Headers to getSession
    const session = await auth.api.getSession({
      headers: webHeaders,
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Please log in to access this resource.",
      });
    }

    req.session = session.session;
    req.user = session.user;

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication check.",
    });
  }
};

/**
 * Middleware to restrict access exclusively to ADMIN users.
 * MUST be placed after requireAuth in the routing pipeline.
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Ensure requireAuth ran first and populated req.user
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Missing authentication context.",
    });
  }

  // Check the custom role field managed by better-auth
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Access denied. Administrative privileges required.",
    });
  }

  next();
};
