import jwt from "jsonwebtoken";

export function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res
      .status(401)
      .json({ message: "Authentication required. Please log in." });
  }

  try {
    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET || "batloung-fruits-secret-change-me-2026"
    );
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Authentication required. Please log in." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action.",
      });
    }

    next();
  };
}
