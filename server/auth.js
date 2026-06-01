import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const JWT_SECRET = process.env.JWT_SECRET || 'stride-dev-secret-change-in-prod';

// Safe, non-reversible fingerprint so we can confirm the SAME secret is used to
// sign and verify without printing the secret itself into deploy logs.
export const JWT_SECRET_SOURCE = process.env.JWT_SECRET ? 'env:JWT_SECRET' : 'fallback-default';
export const JWT_SECRET_FP = crypto.createHash('sha256').update(JWT_SECRET).digest('hex').slice(0, 12);

console.log(`[stride] JWT secret loaded — source=${JWT_SECRET_SOURCE} length=${JWT_SECRET.length} fingerprint=${JWT_SECRET_FP}`);

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, display_name: user.display_name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
