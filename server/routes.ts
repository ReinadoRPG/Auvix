import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db } from './db';
import { PresenceStatus } from '../src/types';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  requireAuth,
  AuthenticatedRequest,
} from './auth';

export const router = Router();

// Configure Multer Storage for file uploads
const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

// ==========================================
// 1. FILE UPLOAD ENDPOINT
// ==========================================

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/flac',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'text/plain',
]);

router.post('/upload', requireAuth, upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // MIME type validation
    if (!ALLOWED_MIME_TYPES.has(req.file.mimetype) && !req.file.mimetype.startsWith('image/') && !req.file.mimetype.startsWith('audio/')) {
      return res.status(400).json({ error: `Tipo de arquivo não permitido (${req.file.mimetype}). Envie imagens, áudios ou documentos válidos.` });
    }

    // Size limit check (25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (req.file.size > MAX_SIZE) {
      return res.status(400).json({ error: 'O arquivo excede o limite máximo permitido de 25MB.' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    return res.status(201).json({
      url: fileUrl,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Falha ao processar upload de arquivo.' });
  }
});

// ==========================================
// 2. AUTHENTICATION & USERS
// ==========================================

router.post('/auth/register', async (req, res) => {
  try {
    const { username, displayName, email, password } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return res.status(400).json({ error: 'Nome de usuário (@username) deve conter no mínimo 2 caracteres.' });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
    }

    const user = await db.createUser(username, email, password, displayName);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    db.createSession(user.id, refreshToken);

    return res.status(201).json({
      user,
      accessToken,
      refreshToken,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao registrar usuário.' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const identifier = req.body.identifier || req.body.email || req.body.username || req.body.login;
    const { password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Informe email/@username e sua senha.' });
    }

    const userWithHash = await db.findUserByEmailOrUsername(identifier);
    if (!userWithHash) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu login e senha.' });
    }

    const isValid = await bcrypt.compare(password, userWithHash.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu login e senha.' });
    }

    const safeUser = db.sanitizeUser(userWithHash);
    const accessToken = generateAccessToken(safeUser);
    const refreshToken = generateRefreshToken(safeUser);

    db.createSession(safeUser.id, refreshToken);
    
    // Restore persistent presence choice (e.g. DO_NOT_DISTURB) instead of blindly resetting to ONLINE
    const rawPref = userWithHash.presenceStatus || (safeUser.status !== 'OFFLINE' ? safeUser.status : 'ONLINE');
    const preferredStatus: PresenceStatus = rawPref === 'DND' ? 'DO_NOT_DISTURB' : rawPref;
    const effectiveDisplayStatus = preferredStatus === 'INVISIBLE' ? 'OFFLINE' : preferredStatus;
    db.updateUserStatus(safeUser.id, effectiveDisplayStatus as any);
    safeUser.status = preferredStatus;
    safeUser.presenceStatus = preferredStatus;

    return res.json({
      user: safeUser,
      accessToken,
      refreshToken,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro no servidor ao processar login.' });
  }
});

router.post('/auth/firebase-google', async (req, res) => {
  try {
    const { email, displayName, photoUrl, firebaseUid } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email não retornado pelo Firebase.' });
    }

    // Check if user exists
    let user = await db.findUserByEmail(email);

    if (!user) {
      const baseUsername = (displayName || email.split('@')[0])
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, '') || `user_${Date.now().toString().slice(-4)}`;

      // Ensure unique username
      let finalUsername = baseUsername;
      let counter = 1;
      while (db.findUserByUsername(finalUsername)) {
        finalUsername = `${baseUsername}${counter++}`;
      }

      const created = await db.createUser(
        finalUsername,
        email,
        `firebase_oauth_${firebaseUid || Date.now()}`,
        displayName || baseUsername
      );

      if (photoUrl) {
        db.updateUserProfile(created.id, { avatarUrl: photoUrl });
      }

      user = db.findUserById(created.id);
    } else {
      if (photoUrl && (!user.avatarUrl || user.avatarUrl.includes('placeholder'))) {
        db.updateUserProfile(user.id, { avatarUrl: photoUrl });
        user = db.findUserById(user.id);
      }
    }

    if (!user) {
      return res.status(500).json({ error: 'Falha ao sincronizar conta do Google.' });
    }

    const safeUser = db.sanitizeUser(user);
    const accessToken = generateAccessToken(safeUser);
    const refreshToken = generateRefreshToken(safeUser);

    db.createSession(safeUser.id, refreshToken);
    
    // Restore persistent presence choice (e.g. DO_NOT_DISTURB)
    const rawGooglePref = user.presenceStatus || (safeUser.status !== 'OFFLINE' ? safeUser.status : 'ONLINE');
    const preferredStatus: PresenceStatus = rawGooglePref === 'DND' ? 'DO_NOT_DISTURB' : rawGooglePref;
    const effectiveDisplayStatus = preferredStatus === 'INVISIBLE' ? 'OFFLINE' : preferredStatus;
    db.updateUserStatus(safeUser.id, effectiveDisplayStatus as any);
    safeUser.status = preferredStatus;
    safeUser.presenceStatus = preferredStatus;

    return res.json({
      user: safeUser,
      accessToken,
      refreshToken,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao autenticar com Firebase Google.' });
  }
});

router.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token é obrigatório.' });
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return res.status(401).json({ error: 'Refresh token expirado ou inválido.' });
    }

    const session = db.findSessionByRefreshToken(refreshToken);
    if (!session) {
      return res.status(401).json({ error: 'Sessão inválida ou já revogada.' });
    }

    const user = db.findUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    db.deleteSession(session.id);
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    db.createSession(user.id, newRefreshToken);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao renovar token de acesso.' });
  }
});

router.post('/auth/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const session = db.findSessionByRefreshToken(refreshToken);
      if (session) {
        db.deleteSession(session.id);
      }
    } else if (req.userId) {
      db.deleteUserSessions(req.userId);
    }

    if (req.userId) {
      db.updateUserStatus(req.userId, 'OFFLINE');
    }

    return res.json({ success: true, message: 'Logout realizado com sucesso.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao efetuar logout.' });
  }
});

router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = db.findUserById(req.userId!);
  return res.json({ user: user || req.user });
});

router.patch('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { displayName, username, avatarUrl, bannerUrl, customStatus, bio, status, presenceStatus } = req.body;
    const updated = db.updateUserProfile(req.userId!, {
      displayName,
      username,
      avatarUrl,
      bannerUrl,
      customStatus,
      bio,
      status,
      presenceStatus,
    });
    return res.json({ user: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao atualizar perfil.' });
  }
});

// Explicit user presence preference endpoint
router.patch('/users/me/presence', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, customStatus } = req.body;
    const allowed = ['ONLINE', 'IDLE', 'DO_NOT_DISTURB', 'DND', 'INVISIBLE'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: 'Status de presença inválido. Escolha ONLINE, IDLE, DO_NOT_DISTURB ou INVISIBLE.' });
    }

    const normalizedStatus = status === 'DND' ? 'DO_NOT_DISTURB' : status;
    const updatedUser = db.setUserPresencePreference(req.userId!, normalizedStatus as any, customStatus);
    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.json({ user: updatedUser, presenceStatus: updatedUser.presenceStatus });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao atualizar presença.' });
  }
});

// Users search by query or @handle
router.get('/users/search', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const users = db.searchUsers(q, req.userId);
    return res.json({ users });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao pesquisar usuários.' });
  }
});

router.get('/users/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao carregar usuário.' });
  }
});

// ==========================================
// 3. FRIENDS & SOCIAL
// ==========================================

router.get('/friends', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const friends = db.getFriends(req.userId!);
    const requests = db.getFriendRequests(req.userId!);
    return res.json({ friends, requests });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao obter lista de amigos.' });
  }
});

router.post('/friends/request', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetUsername } = req.body;
    if (!targetUsername || typeof targetUsername !== 'string') {
      return res.status(400).json({ error: 'Informe o @username do usuário que deseja adicionar.' });
    }

    const request = db.sendFriendRequest(req.userId!, targetUsername);
    return res.status(201).json({ request, message: `Solicitação enviada para @${targetUsername.replace(/^@+/, '')}!` });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao enviar solicitação de amizade.' });
  }
});

router.post('/friends/accept/:requestId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const request = db.acceptFriendRequest(req.params.requestId, req.userId!);
    return res.json({ request, success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao aceitar solicitação.' });
  }
});

router.post('/friends/reject/:requestId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const ok = db.rejectFriendRequest(req.params.requestId, req.userId!);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao recusar solicitação.' });
  }
});

router.delete('/friends/:friendId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const ok = db.removeFriend(req.userId!, req.params.friendId);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao remover amigo.' });
  }
});

// ==========================================
// 4. DIRECT MESSAGES (DMs)
// ==========================================

router.get('/dms', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const channels = db.getDMChannels(req.userId!);
    return res.json({ channels });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao listar canais de DM.' });
  }
});

router.post('/dms/open', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId) return res.status(400).json({ error: 'recipientId é obrigatório.' });

    const channel = db.openDMChannel(req.userId!, recipientId);
    return res.json({ channel });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao abrir DM.' });
  }
});

router.get('/dms/:channelId/messages', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const messages = db.getDMMessages(req.params.channelId);
    return res.json({ messages });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar mensagens diretas.' });
  }
});

router.post('/dms/:channelId/messages', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content, attachments } = req.body;
    if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Mensagem vazia.' });
    }

    const message = db.createDMMessage(req.params.channelId, req.userId!, content || '', attachments);
    return res.status(201).json({ message });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao enviar mensagem direta.' });
  }
});

// ==========================================
// 5. SERVERS ENDPOINTS
// ==========================================

router.get('/servers', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const servers = db.getUserServers(req.userId!);
    return res.json({ servers });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao listar servidores.' });
  }
});

router.post('/servers', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, iconUrl } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Nome do servidor deve ter no mínimo 2 caracteres.' });
    }

    const server = db.createServer(name, req.userId!, description, iconUrl);
    return res.status(201).json({ server });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao criar servidor.' });
  }
});

router.get('/servers/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const server = db.getServerById(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }
    const isMember = server.members.some((m) => m.userId === req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Acesso negado ao servidor.' });
    }
    return res.json({ server });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao obter servidor.' });
  }
});

router.patch('/servers/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const server = db.getServerById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado.' });

    const canManage = db.hasPermission(server.id, req.userId!, 'MANAGE_SERVER');
    if (!canManage) {
      return res.status(403).json({ error: 'Você não tem permissão para gerenciar este servidor.' });
    }

    const { name, description, iconUrl } = req.body;
    const updated = db.updateServer(server.id, { name, description, iconUrl });
    return res.json({ server: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao atualizar servidor.' });
  }
});

router.delete('/servers/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const server = db.getServerById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado.' });
    if (server.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Apenas o proprietário original pode excluir o servidor.' });
    }

    db.deleteServer(server.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao excluir servidor.' });
  }
});

// ==========================================
// 6. SERVER ROLES & PERMISSIONS
// ==========================================

router.get('/servers/:id/roles', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = db.getServerRoles(req.params.id);
    return res.json({ roles });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao carregar cargos.' });
  }
});

router.post('/servers/:id/roles', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!db.hasPermission(req.params.id, req.userId!, 'MANAGE_ROLES')) {
      return res.status(403).json({ error: 'Permissão insuficiente para criar cargos.' });
    }

    const { name, color, permissions } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nome do cargo é obrigatório.' });

    const role = db.createRole(req.params.id, { name, color, permissions });
    return res.status(201).json({ role });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao criar cargo.' });
  }
});

router.patch('/servers/:id/roles/:roleId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!db.hasPermission(req.params.id, req.userId!, 'MANAGE_ROLES')) {
      return res.status(403).json({ error: 'Permissão insuficiente para gerenciar cargos.' });
    }

    const { name, color, permissions, position } = req.body;
    const role = db.updateRole(req.params.roleId, { name, color, permissions, position });
    if (!role) return res.status(404).json({ error: 'Cargo não encontrado.' });
    return res.json({ role });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao editar cargo.' });
  }
});

router.delete('/servers/:id/roles/:roleId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!db.hasPermission(req.params.id, req.userId!, 'MANAGE_ROLES')) {
      return res.status(403).json({ error: 'Permissão insuficiente para excluir cargos.' });
    }

    const ok = db.deleteRole(req.params.roleId);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao excluir cargo.' });
  }
});

router.post('/servers/:id/members/:userId/roles', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!db.hasPermission(req.params.id, req.userId!, 'MANAGE_ROLES')) {
      return res.status(403).json({ error: 'Permissão insuficiente para atribuir cargos.' });
    }

    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ error: 'roleId é obrigatório.' });

    const member = db.assignRoleToMember(req.params.id, req.params.userId, roleId);
    return res.json({ member });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao atribuir cargo.' });
  }
});

router.delete('/servers/:id/members/:userId/roles/:roleId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!db.hasPermission(req.params.id, req.userId!, 'MANAGE_ROLES')) {
      return res.status(403).json({ error: 'Permissão insuficiente para remover cargos.' });
    }

    const member = db.removeRoleFromMember(req.params.id, req.params.userId, req.params.roleId);
    return res.json({ member });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao remover cargo.' });
  }
});

// ==========================================
// 7. MODERATION (KICK & BAN)
// ==========================================

router.post('/servers/:id/members/:userId/kick', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const ok = db.kickMember(req.params.id, req.params.userId, req.userId!);
    return res.json({ success: ok, message: 'Membro expulso com sucesso.' });
  } catch (err: any) {
    return res.status(403).json({ error: err.message || 'Erro ao expulsar membro.' });
  }
});

router.post('/servers/:id/members/:userId/ban', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const ban = db.banMember(req.params.id, req.params.userId, req.userId!, reason);
    return res.json({ success: true, ban, message: 'Membro banido com sucesso.' });
  } catch (err: any) {
    return res.status(403).json({ error: err.message || 'Erro ao banir membro.' });
  }
});

router.delete('/servers/:id/bans/:userId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const ok = db.unbanMember(req.params.id, req.params.userId, req.userId!);
    return res.json({ success: ok, message: 'Banimento revogado.' });
  } catch (err: any) {
    return res.status(403).json({ error: err.message || 'Erro ao desbanir usuário.' });
  }
});

router.get('/servers/:id/bans', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const bans = db.getServerBans(req.params.id, req.userId!);
    return res.json({ bans });
  } catch (err: any) {
    return res.status(403).json({ error: err.message || 'Erro ao carregar banimentos.' });
  }
});

// ==========================================
// 8. CHANNELS ENDPOINTS
// ==========================================

router.post('/servers/:id/channels', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!db.hasPermission(req.params.id, req.userId!, 'MANAGE_CHANNEL')) {
      return res.status(403).json({ error: 'Permissão insuficiente para criar canais.' });
    }

    const { name, type, topic } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Nome do canal é obrigatório.' });
    }
    if (type !== 'TEXT' && type !== 'VOICE') {
      return res.status(400).json({ error: 'Tipo de canal inválido.' });
    }

    const channel = db.createChannel(req.params.id, name, type, topic);
    return res.status(201).json({ channel });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao criar canal.' });
  }
});

router.patch('/channels/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const channel = db.getChannelById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Canal não encontrado.' });

    if (!db.hasPermission(channel.serverId, req.userId!, 'MANAGE_CHANNEL')) {
      return res.status(403).json({ error: 'Permissão insuficiente para editar canais.' });
    }

    const { name, topic } = req.body;
    const updated = db.updateChannel(req.params.id, { name, topic });
    return res.json({ channel: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao atualizar canal.' });
  }
});

router.delete('/channels/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const channel = db.getChannelById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Canal não encontrado.' });

    if (!db.hasPermission(channel.serverId, req.userId!, 'MANAGE_CHANNEL')) {
      return res.status(403).json({ error: 'Permissão insuficiente para excluir canais.' });
    }

    const ok = db.deleteChannel(req.params.id);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao excluir canal.' });
  }
});

// ==========================================
// 9. MESSAGES ENDPOINTS
// ==========================================

router.get('/channels/:id/messages', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const messages = db.getChannelMessages(req.params.id);
    return res.json({ messages });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar mensagens.' });
  }
});

router.post('/channels/:id/messages', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content, attachments } = req.body;
    if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Mensagem vazia.' });
    }

    const { message } = db.createMessage(req.params.id, req.userId!, content || '', attachments);
    return res.status(201).json({ message });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao enviar mensagem.' });
  }
});

router.post('/messages/:id/reactions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji obrigatório.' });

    const message = db.toggleMessageReaction(req.params.id, req.userId!, emoji);
    if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    return res.json({ message });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao atualizar reação.' });
  }
});

router.delete('/messages/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const ok = db.deleteMessage(req.params.id, req.userId!);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.status(403).json({ error: err.message || 'Erro ao excluir mensagem.' });
  }
});

// ==========================================
// 10. INVITES ENDPOINTS
// ==========================================

router.post('/servers/:id/invites', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { maxUses, expiresInHours } = req.body;
    const invite = db.createInvite(req.params.id, req.userId!, maxUses || 0, expiresInHours ?? 24);
    return res.status(201).json({ invite });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao criar convite.' });
  }
});

router.get('/invites/:code', (req, res) => {
  try {
    const invite = db.getInviteByCode(req.params.code);
    if (!invite) return res.status(404).json({ error: 'Convite inválido ou expirado.' });

    const server = db.getServerById(invite.serverId);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado.' });

    return res.json({
      invite,
      server: {
        id: server.id,
        name: server.name,
        iconUrl: server.iconUrl,
        description: server.description,
        memberCount: server.memberCount,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao verificar convite.' });
  }
});

router.post('/invites/:code/join', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const server = db.useInvite(req.params.code, req.userId!);
    return res.json({ server });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao entrar no servidor.' });
  }
});

// ==========================================
// 12. NOTIFICATIONS
// ==========================================

router.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = db.getNotificationsForUser(req.userId!);
    const unreadCount = db.getUnreadNotificationsCount(req.userId!);
    return res.json({ notifications, unreadCount });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar notificações.' });
  }
});

router.post('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const notif = db.markNotificationAsRead(req.userId!, req.params.id);
    if (!notif) return res.status(404).json({ error: 'Notificação não encontrada.' });
    return res.json({ notification: notif, success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao marcar notificação como lida.' });
  }
});

router.post('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.markAllNotificationsAsRead(req.userId!);
    return res.json({ success: true, message: 'Todas as notificações foram marcadas como lidas.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao marcar todas as notificações como lidas.' });
  }
});

router.delete('/notifications/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const ok = db.deleteNotification(req.userId!, req.params.id);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao remover notificação.' });
  }
});

