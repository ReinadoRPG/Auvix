import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  User,
  Session,
  Server,
  ServerMember,
  Role,
  Channel,
  Message,
  Invite,
  Reaction,
  Permission,
  Friend,
  FriendRequest,
  DMChannel,
  DirectMessage,
  ServerBan,
  Notification,
  PresenceStatus,
} from '../src/types';

interface DatabaseSchema {
  users: Array<User & { passwordHash: string; presenceStatus?: PresenceStatus }>;
  sessions: Session[];
  servers: Server[];
  serverMembers: ServerMember[];
  roles: Role[];
  channels: Channel[];
  messages: Message[];
  invites: Invite[];
  friends: Array<{ id: string; user1Id: string; user2Id: string; createdAt: string }>;
  friendRequests: Array<{ id: string; senderId: string; receiverId: string; status: 'PENDING' | 'ACCEPTED' | 'REJECTED'; createdAt: string }>;
  dmChannels: Array<{ id: string; user1Id: string; user2Id: string; createdAt: string }>;
  dmMessages: DirectMessage[];
  serverBans: ServerBan[];
  notifications: Notification[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'auvix_db.json');

class Database {
  private data: DatabaseSchema = {
    users: [],
    sessions: [],
    servers: [],
    serverMembers: [],
    roles: [],
    channels: [],
    messages: [],
    invites: [],
    friends: [],
    friendRequests: [],
    dmChannels: [],
    dmMessages: [],
    serverBans: [],
    notifications: [],
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          users: parsed.users || [],
          sessions: parsed.sessions || [],
          servers: parsed.servers || [],
          serverMembers: parsed.serverMembers || [],
          roles: parsed.roles || [],
          channels: parsed.channels || [],
          messages: parsed.messages || [],
          invites: parsed.invites || [],
          friends: parsed.friends || [],
          friendRequests: parsed.friendRequests || [],
          dmChannels: parsed.dmChannels || [],
          dmMessages: parsed.dmMessages || [],
          serverBans: parsed.serverBans || [],
          notifications: parsed.notifications || [],
        };
        // Clean out any legacy mock bots if present in JSON file
        this.purgeMockAccounts();
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error initializing database:', err);
    }
  }

  private purgeMockAccounts() {
    const mockIds = ['usr_system_admin'];
    const mockUsernames = ['auvixbot'];
    this.data.users = this.data.users.filter(
      (u) => !mockIds.includes(u.id) && !mockUsernames.includes(u.username.toLowerCase())
    );
    this.data.serverMembers = this.data.serverMembers.filter(
      (m) => !mockIds.includes(m.userId)
    );
    this.save();
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  // ==========================================
  // USERS & AUTH (No mock users, strictly real)
  // ==========================================

  public async createUser(
    rawUsername: string,
    email: string,
    passwordPlain: string,
    rawDisplayName?: string
  ): Promise<User> {
    // Normalize username handle (@username, lowercase, alphanumeric + underscores/dots)
    const cleanUsername = rawUsername
      .trim()
      .replace(/^@+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, '');

    if (cleanUsername.length < 2) {
      throw new Error('Nome de usuário deve conter no mínimo 2 caracteres válidos (letras, números, _, .)');
    }

    const cleanDisplayName = (rawDisplayName && rawDisplayName.trim()) || rawUsername.trim();

    const existingEmail = this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existingEmail) {
      throw new Error('Email já está em uso.');
    }

    const existingUsername = this.data.users.find(
      (u) => u.username.toLowerCase() === cleanUsername
    );
    if (existingUsername) {
      throw new Error(`O @username "${cleanUsername}" já está em uso. Escolha outro.`);
    }

    const passwordHash = await bcrypt.hash(passwordPlain, 10);
    const now = new Date().toISOString();
    const id = 'usr_' + crypto.randomUUID();

    const newUser: User & { passwordHash: string } = {
      id,
      username: cleanUsername,
      displayName: cleanDisplayName,
      email: email.trim().toLowerCase(),
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUsername)}`,
      status: 'ONLINE',
      customStatus: 'Disponível',
      bio: '',
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    this.data.users.push(newUser);
    this.save();
    return this.sanitizeUser(newUser);
  }

  public async findUserByEmailOrUsername(identifier: string): Promise<(User & { passwordHash: string }) | null> {
    const idf = identifier.trim().replace(/^@+/, '').toLowerCase();
    const user = this.data.users.find(
      (u) => u.email.toLowerCase() === idf || u.username.toLowerCase() === idf
    );
    return user || null;
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    const cleanEmail = email.trim().toLowerCase();
    const user = this.data.users.find((u) => u.email.toLowerCase() === cleanEmail);
    return user ? this.sanitizeUser(user) : null;
  }

  public findUserById(id: string): User | null {
    const user = this.data.users.find((u) => u.id === id);
    return user ? this.sanitizeUser(user) : null;
  }

  public findUserByUsername(username: string): User | null {
    const clean = username.trim().replace(/^@+/, '').toLowerCase();
    const user = this.data.users.find((u) => u.username.toLowerCase() === clean);
    return user ? this.sanitizeUser(user) : null;
  }

  public searchUsers(query: string, currentUserId?: string): User[] {
    const q = query.trim().replace(/^@+/, '').toLowerCase();
    if (!q) return [];
    return this.data.users
      .filter((u) => {
        if (currentUserId && u.id === currentUserId) return false;
        return (
          u.username.toLowerCase().includes(q) ||
          (u.displayName && u.displayName.toLowerCase().includes(q))
        );
      })
      .slice(0, 15)
      .map((u) => this.sanitizeUser(u));
  }

  public updateUserStatus(userId: string, status: User['status'], customStatus?: string): User | null {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return null;
    user.status = status;
    if (customStatus !== undefined) user.customStatus = customStatus;
    user.updatedAt = new Date().toISOString();

    // Update in server members cache
    this.data.serverMembers.forEach((m) => {
      if (m.userId === userId) {
        m.user.status = status;
        if (customStatus !== undefined) m.user.customStatus = customStatus;
      }
    });

    this.save();
    return this.sanitizeUser(user);
  }

  public setUserPresencePreference(userId: string, presence: PresenceStatus, customStatus?: string): User | null {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return null;

    user.presenceStatus = presence;
    user.status = presence === 'INVISIBLE' ? 'OFFLINE' : presence;
    if (customStatus !== undefined) user.customStatus = customStatus;
    user.updatedAt = new Date().toISOString();

    this.data.serverMembers.forEach((m) => {
      if (m.userId === userId) {
        m.user.status = user.status;
        m.user.presenceStatus = presence;
        if (customStatus !== undefined) m.user.customStatus = customStatus;
      }
    });

    this.save();
    return this.sanitizeUser(user);
  }

  public updateUserProfile(
    userId: string,
    data: {
      displayName?: string;
      username?: string;
      avatarUrl?: string;
      bannerUrl?: string;
      customStatus?: string;
      bio?: string;
      status?: User['status'];
      presenceStatus?: PresenceStatus;
    }
  ): User | null {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return null;

    if (data.username) {
      const cleanUsername = data.username.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '');
      if (cleanUsername !== user.username) {
        const exists = this.data.users.find(
          (u) => u.id !== userId && u.username.toLowerCase() === cleanUsername
        );
        if (exists) throw new Error(`O @username "${cleanUsername}" já está em uso.`);
        user.username = cleanUsername;
      }
    }

    if (data.displayName !== undefined) user.displayName = data.displayName.trim();
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    if (data.bannerUrl !== undefined) user.bannerUrl = data.bannerUrl;
    if (data.customStatus !== undefined) user.customStatus = data.customStatus;
    if (data.bio !== undefined) user.bio = data.bio;
    if (data.presenceStatus !== undefined) {
      user.presenceStatus = data.presenceStatus;
      user.status = data.presenceStatus === 'INVISIBLE' ? 'OFFLINE' : data.presenceStatus;
    } else if (data.status) {
      user.status = data.status;
    }

    user.updatedAt = new Date().toISOString();

    // Sync user in active server members
    this.data.serverMembers.forEach((m) => {
      if (m.userId === userId) {
        m.user = this.sanitizeUser(user);
      }
    });

    this.save();
    return this.sanitizeUser(user);
  }

  public sanitizeUser(u: User & { passwordHash?: string }): User {
    const { passwordHash, ...safeUser } = u;
    return {
      ...safeUser,
      displayName: safeUser.displayName || safeUser.username,
    };
  }

  // ==========================================
  // SESSIONS
  // ==========================================

  public createSession(userId: string, refreshToken: string, expiresInDays = 365): Session {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    const session: Session = {
      id: 'ses_' + crypto.randomUUID(),
      userId,
      refreshTokenHash: hash,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    this.data.sessions.push(session);
    this.save();
    return session;
  }

  public findSessionByRefreshToken(refreshToken: string): Session | null {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = this.data.sessions.find((s) => s.refreshTokenHash === hash);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.deleteSession(session.id);
      return null;
    }
    return session;
  }

  public deleteSession(sessionId: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.id !== sessionId);
    this.save();
  }

  public deleteUserSessions(userId: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    this.save();
  }

  // ==========================================
  // FRIENDS & FRIEND REQUESTS
  // ==========================================

  public getFriends(userId: string): Friend[] {
    const friendshipRecords = this.data.friends.filter(
      (f) => f.user1Id === userId || f.user2Id === userId
    );

    return friendshipRecords
      .map((f) => {
        const friendId = f.user1Id === userId ? f.user2Id : f.user1Id;
        const friendUser = this.findUserById(friendId);
        if (!friendUser) return null;
        return {
          id: f.id,
          user: friendUser,
          createdAt: f.createdAt,
        };
      })
      .filter((f): f is Friend => f !== null);
  }

  public getFriendRequests(userId: string): { sent: FriendRequest[]; received: FriendRequest[] } {
    const sent: FriendRequest[] = [];
    const received: FriendRequest[] = [];

    this.data.friendRequests.forEach((req) => {
      const sender = this.findUserById(req.senderId);
      const receiver = this.findUserById(req.receiverId);
      if (!sender || !receiver) return;

      const item: FriendRequest = {
        id: req.id,
        senderId: req.senderId,
        sender,
        receiverId: req.receiverId,
        receiver,
        status: req.status,
        createdAt: req.createdAt,
      };

      if (req.senderId === userId && req.status === 'PENDING') {
        sent.push(item);
      } else if (req.receiverId === userId && req.status === 'PENDING') {
        received.push(item);
      }
    });

    return { sent, received };
  }

  public sendFriendRequest(senderId: string, targetUsername: string): FriendRequest {
    const targetUser = this.findUserByUsername(targetUsername);
    if (!targetUser) {
      throw new Error(`Usuário @${targetUsername.replace(/^@+/, '')} não foi encontrado.`);
    }

    if (targetUser.id === senderId) {
      throw new Error('Você não pode enviar uma solicitação de amizade para você mesmo.');
    }

    // Check if already friends
    const isFriend = this.data.friends.some(
      (f) =>
        (f.user1Id === senderId && f.user2Id === targetUser.id) ||
        (f.user2Id === senderId && f.user1Id === targetUser.id)
    );
    if (isFriend) {
      throw new Error(`Você e @${targetUser.username} já são amigos.`);
    }

    // Check if pending request exists
    const existingReq = this.data.friendRequests.find(
      (r) =>
        r.status === 'PENDING' &&
        ((r.senderId === senderId && r.receiverId === targetUser.id) ||
          (r.senderId === targetUser.id && r.receiverId === senderId))
    );

    if (existingReq) {
      if (existingReq.senderId === senderId) {
        throw new Error('Você já enviou uma solicitação de amizade para este usuário.');
      } else {
        // If the other user already sent a request, auto-accept it!
        return this.acceptFriendRequest(existingReq.id, senderId);
      }
    }

    const reqRecord: FriendRequest = {
      id: 'freq_' + crypto.randomUUID(),
      senderId,
      sender: this.findUserById(senderId)!,
      receiverId: targetUser.id,
      receiver: targetUser,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    this.data.friendRequests.push(reqRecord);
    this.save();
    return reqRecord;
  }

  public acceptFriendRequest(requestId: string, currentUserId: string): FriendRequest {
    const req = this.data.friendRequests.find((r) => r.id === requestId);
    if (!req) throw new Error('Solicitação de amizade não encontrada.');
    if (req.receiverId !== currentUserId && req.senderId !== currentUserId) {
      throw new Error('Você não tem permissão para responder a esta solicitação.');
    }

    req.status = 'ACCEPTED';

    // Add to friends collection
    const existingFriend = this.data.friends.some(
      (f) =>
        (f.user1Id === req.senderId && f.user2Id === req.receiverId) ||
        (f.user1Id === req.receiverId && f.user2Id === req.senderId)
    );

    if (!existingFriend) {
      this.data.friends.push({
        id: 'frd_' + crypto.randomUUID(),
        user1Id: req.senderId,
        user2Id: req.receiverId,
        createdAt: new Date().toISOString(),
      });
    }

    this.save();

    const sender = this.findUserById(req.senderId)!;
    const receiver = this.findUserById(req.receiverId)!;
    return {
      id: req.id,
      senderId: req.senderId,
      sender,
      receiverId: req.receiverId,
      receiver,
      status: 'ACCEPTED',
      createdAt: req.createdAt,
    };
  }

  public rejectFriendRequest(requestId: string, currentUserId: string): boolean {
    const index = this.data.friendRequests.findIndex((r) => r.id === requestId);
    if (index === -1) return false;
    const req = this.data.friendRequests[index];
    if (req.receiverId !== currentUserId && req.senderId !== currentUserId) {
      throw new Error('Acesso negado para remover solicitação.');
    }
    this.data.friendRequests.splice(index, 1);
    this.save();
    return true;
  }

  public removeFriend(userId: string, friendId: string): boolean {
    const prevLen = this.data.friends.length;
    this.data.friends = this.data.friends.filter(
      (f) =>
        !(
          (f.user1Id === userId && f.user2Id === friendId) ||
          (f.user2Id === userId && f.user1Id === friendId)
        )
    );
    this.save();
    return this.data.friends.length !== prevLen;
  }

  // ==========================================
  // DIRECT MESSAGES (DMs)
  // ==========================================

  public getDMChannels(userId: string): DMChannel[] {
    const userChannels = this.data.dmChannels.filter(
      (c) => c.user1Id === userId || c.user2Id === userId
    );

    const channels: DMChannel[] = [];
    for (const c of userChannels) {
      const recipientId = c.user1Id === userId ? c.user2Id : c.user1Id;
      const recipient = this.findUserById(recipientId);
      if (!recipient) continue;

      const messages = this.data.dmMessages.filter((m) => m.dmChannelId === c.id);
      const lastMessage = messages[messages.length - 1];

      channels.push({
        id: c.id,
        recipientId,
        recipient,
        lastMessage,
        unreadCount: 0,
        createdAt: c.createdAt,
      });
    }

    return channels;
  }

  public openDMChannel(user1Id: string, user2Id: string): DMChannel {
    if (user1Id === user2Id) {
      throw new Error('Não é possível abrir canal de mensagem direta consigo mesmo.');
    }

    let channel = this.data.dmChannels.find(
      (c) =>
        (c.user1Id === user1Id && c.user2Id === user2Id) ||
        (c.user1Id === user2Id && c.user2Id === user1Id)
    );

    if (!channel) {
      channel = {
        id: 'dmc_' + crypto.randomUUID(),
        user1Id,
        user2Id,
        createdAt: new Date().toISOString(),
      };
      this.data.dmChannels.push(channel);
      this.save();
    }

    const recipient = this.findUserById(user2Id)!;
    const messages = this.data.dmMessages.filter((m) => m.dmChannelId === channel!.id);
    return {
      id: channel.id,
      recipientId: user2Id,
      recipient,
      lastMessage: messages[messages.length - 1],
      createdAt: channel.createdAt,
    };
  }

  public getDMMessages(dmChannelId: string, limit = 100): DirectMessage[] {
    return this.data.dmMessages
      .filter((m) => m.dmChannelId === dmChannelId)
      .slice(-limit)
      .map((m) => {
        const author = this.findUserById(m.authorId);
        return {
          ...m,
          author: author || m.author,
        };
      });
  }

  public createDMMessage(
    dmChannelId: string,
    authorId: string,
    content: string,
    attachments?: string[]
  ): DirectMessage {
    const channel = this.data.dmChannels.find((c) => c.id === dmChannelId);
    if (!channel) throw new Error('Canal de DM não encontrado');
    if (channel.user1Id !== authorId && channel.user2Id !== authorId) {
      throw new Error('Acesso negado a este canal');
    }

    const author = this.findUserById(authorId);
    if (!author) throw new Error('Autor não encontrado');

    const msg: DirectMessage = {
      id: 'dmmsg_' + crypto.randomUUID(),
      dmChannelId,
      authorId,
      author,
      content: content.trim(),
      attachments: attachments || [],
      reactions: [],
      createdAt: new Date().toISOString(),
    };

    this.data.dmMessages.push(msg);
    this.save();
    return msg;
  }

  // ==========================================
  // SERVERS & PERMISSIONS ENGINE
  // ==========================================

  public getUserServers(userId: string): Server[] {
    const memberServerIds = this.data.serverMembers
      .filter((m) => m.userId === userId)
      .map((m) => m.serverId);

    return this.data.servers
      .filter((s) => memberServerIds.includes(s.id))
      .map((s) => this.hydrateServer(s));
  }

  public getServerById(serverId: string): Server | null {
    const server = this.data.servers.find((s) => s.id === serverId);
    if (!server) return null;
    return this.hydrateServer(server);
  }

  public createServer(
    name: string,
    ownerId: string,
    description?: string,
    iconUrl?: string
  ): Server {
    const user = this.findUserById(ownerId);
    if (!user) throw new Error('Usuário proprietário não encontrado');

    const now = new Date().toISOString();
    const serverId = 'srv_' + crypto.randomUUID();

    const ownerRoleId = 'role_owner_' + serverId;
    const adminRoleId = 'role_admin_' + serverId;
    const memberRoleId = 'role_member_' + serverId;

    const allPermissions: Permission[] = [
      'VIEW_CHANNEL',
      'SEND_MESSAGES',
      'CONNECT',
      'SPEAK',
      'STREAM',
      'MANAGE_CHANNEL',
      'MANAGE_SERVER',
      'MANAGE_MESSAGES',
      'MANAGE_ROLES',
      'KICK_MEMBERS',
      'BAN_MEMBERS',
      'ADMINISTRATOR',
    ];

    const roles: Role[] = [
      {
        id: ownerRoleId,
        serverId,
        name: 'Proprietário',
        color: '#F27D26',
        position: 1,
        permissions: allPermissions,
      },
      {
        id: adminRoleId,
        serverId,
        name: 'Administrador',
        color: '#06b6d4',
        position: 2,
        permissions: [
          'VIEW_CHANNEL',
          'SEND_MESSAGES',
          'CONNECT',
          'SPEAK',
          'STREAM',
          'MANAGE_CHANNEL',
          'MANAGE_MESSAGES',
          'MANAGE_ROLES',
          'KICK_MEMBERS',
          'BAN_MEMBERS',
        ],
      },
      {
        id: memberRoleId,
        serverId,
        name: 'Membro',
        color: '#94a3b8',
        position: 3,
        permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'CONNECT', 'SPEAK', 'STREAM'],
      },
    ];

    const generalChannel: Channel = {
      id: 'chn_' + crypto.randomUUID(),
      serverId,
      name: 'geral',
      type: 'TEXT',
      topic: 'Canal de texto principal da comunidade',
      position: 1,
      createdAt: now,
    };

    const voiceChannel: Channel = {
      id: 'chn_' + crypto.randomUUID(),
      serverId,
      name: '🔊 Sala de Voz',
      type: 'VOICE',
      topic: 'Canal de voz com áudio e vídeo',
      position: 2,
      createdAt: now,
    };

    const member: ServerMember = {
      id: 'mem_' + ownerId + '_' + serverId,
      serverId,
      userId: ownerId,
      roleId: ownerRoleId,
      roleIds: [ownerRoleId],
      user,
      joinedAt: now,
    };

    const server: Server = {
      id: serverId,
      name: name.trim(),
      description: description?.trim() || '',
      iconUrl:
        iconUrl ||
        `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
      ownerId,
      channels: [generalChannel, voiceChannel],
      roles,
      members: [member],
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.data.roles.push(...roles);
    this.data.channels.push(generalChannel, voiceChannel);
    this.data.serverMembers.push(member);
    this.data.servers.push(server);

    // Initial welcome message from the server creator
    const welcomeMsg: Message = {
      id: 'msg_' + crypto.randomUUID(),
      channelId: generalChannel.id,
      authorId: ownerId,
      author: user,
      content: `👋 Bem-vindo ao servidor **${server.name}**! Este é o início do canal #geral.`,
      reactions: [],
      createdAt: now,
    };
    this.data.messages.push(welcomeMsg);

    this.save();
    return this.hydrateServer(server);
  }

  public updateServer(
    serverId: string,
    data: { name?: string; description?: string; iconUrl?: string }
  ): Server | null {
    const server = this.data.servers.find((s) => s.id === serverId);
    if (!server) return null;
    if (data.name) server.name = data.name.trim();
    if (data.description !== undefined) server.description = data.description.trim();
    if (data.iconUrl !== undefined) server.iconUrl = data.iconUrl;
    server.updatedAt = new Date().toISOString();
    this.save();
    return this.hydrateServer(server);
  }

  public deleteServer(serverId: string): boolean {
    const index = this.data.servers.findIndex((s) => s.id === serverId);
    if (index === -1) return false;
    this.data.servers.splice(index, 1);
    this.data.channels = this.data.channels.filter((c) => c.serverId !== serverId);
    this.data.serverMembers = this.data.serverMembers.filter((m) => m.serverId !== serverId);
    this.data.roles = this.data.roles.filter((r) => r.serverId !== serverId);
    this.data.invites = this.data.invites.filter((i) => i.serverId !== serverId);
    this.data.serverBans = this.data.serverBans.filter((b) => b.serverId !== serverId);
    this.save();
    return true;
  }

  // ==========================================
  // PERMISSIONS CHECK
  // ==========================================

  public hasPermission(serverId: string, userId: string, permission: Permission): boolean {
    const server = this.data.servers.find((s) => s.id === serverId);
    if (!server) return false;

    // Server owner always has all permissions
    if (server.ownerId === userId) return true;

    const member = this.data.serverMembers.find(
      (m) => m.serverId === serverId && m.userId === userId
    );
    if (!member) return false;

    const memberRoleIds = member.roleIds || (member.roleId ? [member.roleId] : []);
    const memberRoles = this.data.roles.filter((r) => memberRoleIds.includes(r.id));

    // If any role has ADMINISTRATOR, user has all permissions
    if (memberRoles.some((r) => r.permissions.includes('ADMINISTRATOR'))) {
      return true;
    }

    return memberRoles.some((r) => r.permissions.includes(permission));
  }

  // ==========================================
  // ROLES MANAGEMENT
  // ==========================================

  public getServerRoles(serverId: string): Role[] {
    return this.data.roles
      .filter((r) => r.serverId === serverId)
      .sort((a, b) => a.position - b.position);
  }

  public createRole(
    serverId: string,
    data: { name: string; color?: string; permissions?: Permission[] }
  ): Role {
    const existingRoles = this.data.roles.filter((r) => r.serverId === serverId);
    const role: Role = {
      id: 'role_' + crypto.randomUUID(),
      serverId,
      name: data.name.trim(),
      color: data.color || '#94a3b8',
      position: existingRoles.length + 1,
      permissions: data.permissions || ['VIEW_CHANNEL', 'SEND_MESSAGES', 'CONNECT', 'SPEAK', 'STREAM'],
    };

    this.data.roles.push(role);
    this.save();
    return role;
  }

  public updateRole(
    roleId: string,
    data: { name?: string; color?: string; permissions?: Permission[]; position?: number }
  ): Role | null {
    const role = this.data.roles.find((r) => r.id === roleId);
    if (!role) return null;
    if (data.name) role.name = data.name.trim();
    if (data.color) role.color = data.color;
    if (data.permissions) role.permissions = data.permissions;
    if (data.position !== undefined) role.position = data.position;
    this.save();
    return role;
  }

  public deleteRole(roleId: string): boolean {
    const index = this.data.roles.findIndex((r) => r.id === roleId);
    if (index === -1) return false;
    this.data.roles.splice(index, 1);

    // Remove role from members
    this.data.serverMembers.forEach((m) => {
      if (m.roleId === roleId) m.roleId = '';
      if (m.roleIds) m.roleIds = m.roleIds.filter((id) => id !== roleId);
    });

    this.save();
    return true;
  }

  public assignRoleToMember(serverId: string, targetUserId: string, roleId: string): ServerMember {
    const member = this.data.serverMembers.find(
      (m) => m.serverId === serverId && m.userId === targetUserId
    );
    if (!member) throw new Error('Membro não encontrado no servidor');

    if (!member.roleIds) member.roleIds = member.roleId ? [member.roleId] : [];
    if (!member.roleIds.includes(roleId)) {
      member.roleIds.push(roleId);
    }
    member.roleId = roleId; // Set active primary role
    this.save();
    return member;
  }

  public removeRoleFromMember(serverId: string, targetUserId: string, roleId: string): ServerMember {
    const member = this.data.serverMembers.find(
      (m) => m.serverId === serverId && m.userId === targetUserId
    );
    if (!member) throw new Error('Membro não encontrado no servidor');

    if (member.roleIds) {
      member.roleIds = member.roleIds.filter((id) => id !== roleId);
    }
    if (member.roleId === roleId) {
      member.roleId = member.roleIds && member.roleIds.length > 0 ? member.roleIds[0] : '';
    }
    this.save();
    return member;
  }

  // ==========================================
  // SERVER MEMBERS & MODERATION (KICK / BAN)
  // ==========================================

  public getServerMembers(serverId: string): ServerMember[] {
    const members = this.data.serverMembers.filter((m) => m.serverId === serverId);
    const serverRoles = this.data.roles.filter((r) => r.serverId === serverId);

    return members.map((m) => {
      const u = this.findUserById(m.userId);
      const roleIds = m.roleIds || (m.roleId ? [m.roleId] : []);
      const memberRoles = serverRoles.filter((r) => roleIds.includes(r.id));
      const primaryRole = serverRoles.find((r) => r.id === m.roleId) || memberRoles[0];

      return {
        ...m,
        user: u || m.user,
        role: primaryRole || undefined,
        roles: memberRoles,
      };
    });
  }

  public addMemberToServer(serverId: string, userId: string, roleId?: string): ServerMember {
    const server = this.data.servers.find((s) => s.id === serverId);
    if (!server) throw new Error('Servidor não encontrado');

    // Check if banned
    const isBanned = this.data.serverBans.some(
      (b) => b.serverId === serverId && b.userId === userId
    );
    if (isBanned) {
      throw new Error('Você foi banido deste servidor.');
    }

    const existing = this.data.serverMembers.find(
      (m) => m.serverId === serverId && m.userId === userId
    );
    if (existing) return existing;

    const user = this.findUserById(userId);
    if (!user) throw new Error('Usuário não encontrado');

    const defaultRole =
      roleId ||
      this.data.roles.find((r) => r.serverId === serverId && r.name === 'Membro')?.id ||
      '';
    const now = new Date().toISOString();

    const member: ServerMember = {
      id: 'mem_' + userId + '_' + serverId,
      serverId,
      userId,
      roleId: defaultRole,
      roleIds: defaultRole ? [defaultRole] : [],
      user,
      joinedAt: now,
    };

    this.data.serverMembers.push(member);
    server.memberCount = this.data.serverMembers.filter((m) => m.serverId === serverId).length;
    this.save();
    return member;
  }

  public kickMember(serverId: string, targetUserId: string, operatorUserId: string): boolean {
    const server = this.data.servers.find((s) => s.id === serverId);
    if (!server) throw new Error('Servidor não encontrado');
    if (server.ownerId === targetUserId) {
      throw new Error('Não é possível expulsar o proprietário do servidor.');
    }
    if (!this.hasPermission(serverId, operatorUserId, 'KICK_MEMBERS')) {
      throw new Error('Você não tem permissão para expulsar membros.');
    }

    const index = this.data.serverMembers.findIndex(
      (m) => m.serverId === serverId && m.userId === targetUserId
    );
    if (index === -1) return false;

    this.data.serverMembers.splice(index, 1);
    server.memberCount = this.data.serverMembers.filter((m) => m.serverId === serverId).length;
    this.save();
    return true;
  }

  public banMember(
    serverId: string,
    targetUserId: string,
    operatorUserId: string,
    reason?: string
  ): ServerBan {
    const server = this.data.servers.find((s) => s.id === serverId);
    if (!server) throw new Error('Servidor não encontrado');
    if (server.ownerId === targetUserId) {
      throw new Error('Não é possível banir o proprietário do servidor.');
    }
    if (!this.hasPermission(serverId, operatorUserId, 'BAN_MEMBERS')) {
      throw new Error('Você não tem permissão para banir membros.');
    }

    const user = this.findUserById(targetUserId);
    if (!user) throw new Error('Usuário não encontrado');

    // Remove from members
    this.data.serverMembers = this.data.serverMembers.filter(
      (m) => !(m.serverId === serverId && m.userId === targetUserId)
    );
    server.memberCount = this.data.serverMembers.filter((m) => m.serverId === serverId).length;

    // Add to bans
    const ban: ServerBan = {
      id: 'ban_' + crypto.randomUUID(),
      serverId,
      userId: targetUserId,
      user,
      reason: reason?.trim() || 'Violação das diretrizes do servidor',
      bannedBy: operatorUserId,
      createdAt: new Date().toISOString(),
    };

    this.data.serverBans.push(ban);
    this.save();
    return ban;
  }

  public unbanMember(serverId: string, targetUserId: string, operatorUserId: string): boolean {
    if (!this.hasPermission(serverId, operatorUserId, 'BAN_MEMBERS')) {
      throw new Error('Você não tem permissão para revogar banimentos.');
    }
    const prevLen = this.data.serverBans.length;
    this.data.serverBans = this.data.serverBans.filter(
      (b) => !(b.serverId === serverId && b.userId === targetUserId)
    );
    this.save();
    return this.data.serverBans.length !== prevLen;
  }

  public getServerBans(serverId: string, operatorUserId: string): ServerBan[] {
    if (!this.hasPermission(serverId, operatorUserId, 'BAN_MEMBERS')) {
      throw new Error('Você não tem permissão para visualizar banimentos.');
    }
    return this.data.serverBans.filter((b) => b.serverId === serverId);
  }

  public removeMemberFromServer(serverId: string, userId: string): boolean {
    const server = this.data.servers.find((s) => s.id === serverId);
    if (!server) return false;
    if (server.ownerId === userId) throw new Error('O proprietário não pode sair do servidor');
    this.data.serverMembers = this.data.serverMembers.filter(
      (m) => !(m.serverId === serverId && m.userId === userId)
    );
    server.memberCount = this.data.serverMembers.filter((m) => m.serverId === serverId).length;
    this.save();
    return true;
  }

  // ==========================================
  // CHANNELS
  // ==========================================

  public createChannel(
    serverId: string,
    name: string,
    type: 'TEXT' | 'VOICE',
    topic?: string
  ): Channel {
    const server = this.data.servers.find((s) => s.id === serverId);
    if (!server) throw new Error('Servidor não encontrado');

    const existingChannels = this.data.channels.filter((c) => c.serverId === serverId);
    const channel: Channel = {
      id: 'chn_' + crypto.randomUUID(),
      serverId,
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      type,
      topic: topic?.trim() || '',
      position: existingChannels.length + 1,
      createdAt: new Date().toISOString(),
    };

    this.data.channels.push(channel);
    this.save();
    return channel;
  }

  public updateChannel(
    channelId: string,
    data: { name?: string; topic?: string }
  ): Channel | null {
    const channel = this.data.channels.find((c) => c.id === channelId);
    if (!channel) return null;
    if (data.name) channel.name = data.name.trim().toLowerCase().replace(/\s+/g, '-');
    if (data.topic !== undefined) channel.topic = data.topic.trim();
    this.save();
    return channel;
  }

  public deleteChannel(channelId: string): boolean {
    const index = this.data.channels.findIndex((c) => c.id === channelId);
    if (index === -1) return false;
    this.data.channels.splice(index, 1);
    this.data.messages = this.data.messages.filter((m) => m.channelId !== channelId);
    this.save();
    return true;
  }

  public getChannelById(channelId: string): Channel | null {
    return this.data.channels.find((c) => c.id === channelId) || null;
  }

  // ==========================================
  // MESSAGES
  // ==========================================

  public getChannelMessages(channelId: string, limit = 100): Message[] {
    const messages = this.data.messages
      .filter((m) => m.channelId === channelId)
      .slice(-limit);

    return messages.map((m) => {
      const author = this.findUserById(m.authorId);
      return {
        ...m,
        author: author || m.author,
      };
    });
  }

  public createMessage(
    channelId: string,
    authorId: string,
    content: string,
    attachments?: string[]
  ): { message: Message; notifications: Notification[] } {
    const channel = this.data.channels.find((c) => c.id === channelId);
    if (!channel) throw new Error('Canal não encontrado');
    const author = this.findUserById(authorId);
    if (!author) throw new Error('Autor não encontrado');

    const server = this.data.servers.find((s) => s.id === channel.serverId);
    const serverMembers = this.data.serverMembers.filter((m) => m.serverId === channel.serverId);

    // Extract mentions
    const mentionedUserIds = new Set<string>();
    const trimmedContent = content.trim();

    // Check @everyone and @here if allowed
    const canMentionBroadcast = server && (
      server.ownerId === authorId ||
      this.hasPermission(server.id, authorId, 'ADMINISTRATOR') ||
      this.hasPermission(server.id, authorId, 'MANAGE_SERVER')
    );

    if (canMentionBroadcast) {
      if (/@everyone\b/i.test(trimmedContent)) {
        serverMembers.forEach((m) => {
          if (m.userId !== authorId) mentionedUserIds.add(m.userId);
        });
      }
      if (/@here\b/i.test(trimmedContent)) {
        serverMembers.forEach((m) => {
          if (m.userId !== authorId && m.user && m.user.status && m.user.status !== 'OFFLINE' && m.user.status !== 'INVISIBLE') {
            mentionedUserIds.add(m.userId);
          }
        });
      }
    }

    // Direct username mentions: @username
    const usernameMatches = trimmedContent.match(/@([a-zA-Z0-9_.-]+)/g);
    if (usernameMatches) {
      for (const match of usernameMatches) {
        const handle = match.slice(1).toLowerCase();
        if (handle === 'everyone' || handle === 'here') continue;
        const member = serverMembers.find(
          (m) => m.user && m.user.username && m.user.username.toLowerCase() === handle
        );
        if (member && member.userId !== authorId) {
          mentionedUserIds.add(member.userId);
        }
      }
    }

    // Direct user ID mentions: <@userId>
    const idMatches = trimmedContent.match(/<@([a-zA-Z0-9_-]+)>/g);
    if (idMatches) {
      for (const match of idMatches) {
        const uId = match.replace(/<@|>/g, '');
        const member = serverMembers.find((m) => m.userId === uId);
        if (member && member.userId !== authorId) {
          mentionedUserIds.add(member.userId);
        }
      }
    }

    const mentionsList = Array.from(mentionedUserIds);

    const msg: Message = {
      id: 'msg_' + crypto.randomUUID(),
      channelId,
      authorId,
      author,
      content: trimmedContent,
      attachments: attachments || [],
      mentions: mentionsList,
      reactions: [],
      createdAt: new Date().toISOString(),
    };

    this.data.messages.push(msg);

    // Generate notifications
    const createdNotifications: Notification[] = [];
    for (const targetUserId of mentionsList) {
      const notif: Notification = {
        id: 'notif_' + crypto.randomUUID(),
        userId: targetUserId,
        actorUserId: authorId,
        actor: this.sanitizeUser(author),
        type: 'MENTION',
        title: `@${author.username} mencionou você`,
        body: trimmedContent.length > 120 ? trimmedContent.slice(0, 117) + '...' : trimmedContent,
        serverId: server?.id,
        serverName: server?.name,
        channelId: channel.id,
        channelName: channel.name,
        messageId: msg.id,
        readAt: null,
        createdAt: msg.createdAt,
      };
      this.data.notifications.push(notif);
      createdNotifications.push(notif);
    }

    this.save();
    return { message: msg, notifications: createdNotifications };
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  public getNotificationsForUser(userId: string): Notification[] {
    return (this.data.notifications || [])
      .filter((n) => n.userId === userId)
      .map((n) => {
        if (n.actorUserId && (!n.actor || !n.actor.username)) {
          const actor = this.findUserById(n.actorUserId);
          if (actor) n.actor = this.sanitizeUser(actor);
        }
        return n;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getUnreadNotificationsCount(userId: string): number {
    return (this.data.notifications || []).filter(
      (n) => n.userId === userId && !n.readAt
    ).length;
  }

  public markNotificationAsRead(notificationId: string, userId: string): boolean {
    const notif = (this.data.notifications || []).find(
      (n) => n.id === notificationId && n.userId === userId
    );
    if (!notif) return false;
    notif.readAt = new Date().toISOString();
    this.save();
    return true;
  }

  public markAllNotificationsAsRead(userId: string): boolean {
    let updated = false;
    const now = new Date().toISOString();
    (this.data.notifications || []).forEach((n) => {
      if (n.userId === userId && !n.readAt) {
        n.readAt = now;
        updated = true;
      }
    });
    if (updated) this.save();
    return true;
  }

  public deleteNotification(notificationId: string, userId: string): boolean {
    const initialLen = (this.data.notifications || []).length;
    this.data.notifications = (this.data.notifications || []).filter(
      (n) => !(n.id === notificationId && n.userId === userId)
    );
    if (this.data.notifications.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public toggleMessageReaction(messageId: string, userId: string, emoji: string): Message | null {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) return null;

    if (!msg.reactions) msg.reactions = [];
    const reaction = msg.reactions.find((r) => r.emoji === emoji);

    if (reaction) {
      if (reaction.userIds.includes(userId)) {
        reaction.userIds = reaction.userIds.filter((id) => id !== userId);
        reaction.count = reaction.userIds.length;
        if (reaction.count === 0) {
          msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
        }
      } else {
        reaction.userIds.push(userId);
        reaction.count = reaction.userIds.length;
      }
    } else {
      msg.reactions.push({
        emoji,
        userIds: [userId],
        count: 1,
      });
    }

    this.save();
    return msg;
  }

  public deleteMessage(messageId: string, userId: string): boolean {
    const index = this.data.messages.findIndex((m) => m.id === messageId);
    if (index === -1) return false;
    const msg = this.data.messages[index];
    const channel = this.getChannelById(msg.channelId);

    const isAuthor = msg.authorId === userId;
    const canManageMessages = channel ? this.hasPermission(channel.serverId, userId, 'MANAGE_MESSAGES') : false;

    if (!isAuthor && !canManageMessages) {
      throw new Error('Permissão negada para excluir esta mensagem.');
    }

    this.data.messages.splice(index, 1);
    this.save();
    return true;
  }

  // ==========================================
  // INVITES
  // ==========================================

  public createInvite(
    serverId: string,
    inviterId: string,
    maxUses = 0,
    expiresInHours = 24
  ): Invite {
    const server = this.data.servers.find((s) => s.id === serverId);
    if (!server) throw new Error('Servidor não encontrado');

    const code = 'auvix-' + crypto.randomBytes(3).toString('hex');
    const expiresAt =
      expiresInHours > 0
        ? new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
        : undefined;

    const invite: Invite = {
      id: 'inv_' + crypto.randomUUID(),
      code,
      serverId,
      inviterId,
      maxUses,
      uses: 0,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    this.data.invites.push(invite);
    this.save();
    return invite;
  }

  public getInviteByCode(code: string): Invite | null {
    const inv = this.data.invites.find(
      (i) => i.code.toLowerCase() === code.trim().toLowerCase()
    );
    if (!inv) return null;
    if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) {
      return null;
    }
    if (inv.maxUses > 0 && inv.uses >= inv.maxUses) {
      return null;
    }
    return inv;
  }

  public useInvite(code: string, userId: string): Server {
    const invite = this.getInviteByCode(code);
    if (!invite) throw new Error('Convite inválido ou expirado.');

    const server = this.getServerById(invite.serverId);
    if (!server) throw new Error('Servidor associado ao convite não existe.');

    this.addMemberToServer(server.id, userId);
    invite.uses += 1;
    this.save();

    return this.getServerById(server.id)!;
  }

  // ==========================================
  // HYDRATION
  // ==========================================

  private hydrateServer(server: Server): Server {
    const channels = this.data.channels
      .filter((c) => c.serverId === server.id)
      .sort((a, b) => a.position - b.position);
    const roles = this.data.roles
      .filter((r) => r.serverId === server.id)
      .sort((a, b) => a.position - b.position);
    const members = this.getServerMembers(server.id);

    return {
      ...server,
      channels,
      roles,
      members,
      memberCount: members.length,
    };
  }
}

export const db = new Database();
