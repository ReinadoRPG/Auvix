import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { User } from '../src/types';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'auvix-secure-access-jwt-secret-key-production';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'auvix-secure-refresh-jwt-secret-key-production';

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  userId?: string;
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

export function generateAccessToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
  };
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '30d' });
}

export function generateRefreshToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
  };
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '365d' });
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Token expirado ou inválido', code: 'TOKEN_EXPIRED' });
  }

  const user = db.findUserById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'Usuário não encontrado' });
  }

  req.user = user;
  req.userId = user.id;
  next();
}
