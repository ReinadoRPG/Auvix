export type UserStatus = 'ONLINE' | 'IDLE' | 'DND' | 'DO_NOT_DISTURB' | 'INVISIBLE' | 'OFFLINE';
export type PresenceStatus = 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'INVISIBLE' | 'OFFLINE';

export interface User {
  id: string;
  username: string; // Unique handle e.g. "victinnx", displayed as @victinnx
  displayName: string; // Display name e.g. "Victinnx"
  email: string;
  avatarUrl?: string;
  bannerUrl?: string;
  status: UserStatus;
  presenceStatus?: PresenceStatus;
  customStatus?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type Permission =
  | 'VIEW_CHANNEL'
  | 'SEND_MESSAGES'
  | 'CONNECT'
  | 'SPEAK'
  | 'STREAM'
  | 'MANAGE_CHANNEL'
  | 'MANAGE_SERVER'
  | 'MANAGE_MESSAGES'
  | 'MANAGE_ROLES'
  | 'KICK_MEMBERS'
  | 'BAN_MEMBERS'
  | 'ADMINISTRATOR';

export interface Role {
  id: string;
  serverId: string;
  name: string;
  color: string;
  position: number;
  permissions: Permission[];
}

export interface ServerMember {
  id: string;
  serverId: string;
  userId: string;
  roleIds?: string[];
  roleId?: string;
  role?: Role;
  roles?: Role[];
  user: User;
  nickname?: string;
  joinedAt: string;
}

export interface ServerBan {
  id: string;
  serverId: string;
  userId: string;
  user: User;
  reason?: string;
  bannedBy: string;
  createdAt: string;
}

export type ChannelType = 'TEXT' | 'VOICE';

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  topic?: string;
  position: number;
  createdAt: string;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
  count: number;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  author: User;
  content: string;
  attachments?: string[];
  mentions?: string[];
  reactions: Reaction[];
  createdAt: string;
  updatedAt?: string;
  pinned?: boolean;
}

export interface Server {
  id: string;
  name: string;
  iconUrl?: string;
  description?: string;
  ownerId: string;
  channels: Channel[];
  roles: Role[];
  members: ServerMember[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Invite {
  id: string;
  code: string;
  serverId: string;
  inviterId: string;
  maxUses: number;
  uses: number;
  expiresAt?: string;
  createdAt: string;
}

export interface VoiceParticipant {
  userId: string;
  user: User;
  channelId: string;
  serverId: string;
  socketId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  joinedAt: string;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

// Friends & Social Types
export interface FriendRequest {
  id: string;
  senderId: string;
  sender: User;
  receiverId: string;
  receiver: User;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface Friend {
  id: string;
  user: User;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  dmChannelId: string;
  authorId: string;
  author: User;
  content: string;
  attachments?: string[];
  reactions: Reaction[];
  createdAt: string;
  updatedAt?: string;
}

export interface DMChannel {
  id: string;
  recipientId: string;
  recipient: User;
  lastMessage?: DirectMessage;
  unreadCount?: number;
  createdAt: string;
}

export type NotificationType = 'MENTION' | 'FRIEND_REQUEST' | 'SYSTEM' | 'CALL';

export interface Notification {
  id: string;
  userId: string;
  actorUserId?: string;
  actor?: User;
  type: NotificationType;
  title: string;
  body: string;
  serverId?: string;
  serverName?: string;
  channelId?: string;
  channelName?: string;
  messageId?: string;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationStats {
  total: number;
  unreadCount: number;
}

