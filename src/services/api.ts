import {
  AuthResponse,
  User,
  Server,
  Channel,
  Message,
  Invite,
  WebRTCConfig,
  Friend,
  FriendRequest,
  DMChannel,
  DirectMessage,
  Role,
  Permission,
  ServerMember,
  ServerBan,
  PresenceStatus,
  Notification,
  NotificationStats,
} from '../types';

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    try {
      this.accessToken = localStorage.getItem('auvix_access_token');
      this.refreshToken = localStorage.getItem('auvix_refresh_token');
    } catch {
      this.accessToken = null;
      this.refreshToken = null;
    }
  }

  public setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    try {
      localStorage.setItem('auvix_access_token', accessToken);
      localStorage.setItem('auvix_refresh_token', refreshToken);
    } catch (e) {
      console.warn('Unable to persist tokens to localStorage:', e);
    }
  }

  public clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    try {
      localStorage.removeItem('auvix_access_token');
      localStorage.removeItem('auvix_refresh_token');
      localStorage.removeItem('auvix_cached_user');
    } catch (e) {
      console.warn('Unable to clear tokens from localStorage:', e);
    }
  }

  public getCachedUser(): User | null {
    try {
      const item = localStorage.getItem('auvix_cached_user');
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  public setCachedUser(user: User): void {
    try {
      localStorage.setItem('auvix_cached_user', JSON.stringify(user));
    } catch (e) {
      console.warn('Unable to persist user to localStorage:', e);
    }
  }

  public getAccessToken(): string | null {
    if (!this.accessToken) {
      try {
        this.accessToken = localStorage.getItem('auvix_access_token');
      } catch {
        this.accessToken = null;
      }
    }
    return this.accessToken;
  }

  public getRefreshToken(): string | null {
    if (!this.refreshToken) {
      try {
        this.refreshToken = localStorage.getItem('auvix_refresh_token');
      } catch {
        this.refreshToken = null;
      }
    }
    return this.refreshToken;
  }

  private onTokenRefreshed(newToken: string) {
    this.refreshSubscribers.forEach((cb) => {
      try {
        cb(newToken);
      } catch (err) {
        console.error('Error in refresh subscriber callback:', err);
      }
    });
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers as Record<string, string>),
    };

    const currentToken = this.getAccessToken();
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    let response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized - Attempt Automatic Refresh
    if (
      response.status === 401 &&
      this.getRefreshToken() &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/register') &&
      !endpoint.includes('/auth/refresh')
    ) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: this.getRefreshToken() }),
          });

          if (!refreshRes.ok) {
            this.clearTokens();
            this.isRefreshing = false;
            window.dispatchEvent(new CustomEvent('auvix:auth-expired'));
            throw new Error('Sessão expirada. Faça login novamente.');
          }

          const refreshData = await refreshRes.json();
          this.setTokens(refreshData.accessToken, refreshData.refreshToken);
          if (refreshData.user) {
            this.setCachedUser(refreshData.user);
          }
          this.isRefreshing = false;
          this.onTokenRefreshed(refreshData.accessToken);

          // Retry the current request directly with the new token
          headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
          const retryRes = await fetch(`/api${endpoint}`, {
            ...options,
            headers,
          });
          const data = await retryRes.json();
          if (!retryRes.ok) {
            throw new Error(data.error || 'Erro na requisição.');
          }
          return data as T;
        } catch (err) {
          this.isRefreshing = false;
          this.clearTokens();
          window.dispatchEvent(new CustomEvent('auvix:auth-expired'));
          throw err;
        }
      } else {
        // Wait for active token refresh to complete
        return new Promise<T>((resolve, reject) => {
          this.addRefreshSubscriber(async (newToken) => {
            try {
              headers['Authorization'] = `Bearer ${newToken}`;
              const retryRes = await fetch(`/api${endpoint}`, {
                ...options,
                headers,
              });
              const data = await retryRes.json();
              if (!retryRes.ok) {
                reject(new Error(data.error || 'Erro na requisição.'));
              } else {
                resolve(data);
              }
            } catch (e) {
              reject(e);
            }
          });
        });
      }
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro na requisição.');
    }

    return data as T;
  }
}

export const apiClient = new ApiClient();

// Auth API
export const authApi = {
  register: (data: { username: string; displayName?: string; email: string; password: string }) =>
    apiClient.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { identifier: string; password: string }) =>
    apiClient.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  firebaseGoogleLogin: (data: {
    email: string;
    displayName?: string | null;
    photoUrl?: string | null;
    firebaseUid?: string;
  }) =>
    apiClient.request<AuthResponse>('/auth/firebase-google', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    apiClient.request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: apiClient.getRefreshToken() }),
    }),

  fetchMe: () => apiClient.request<{ user: User }>('/auth/me'),

  updateProfile: (data: {
    displayName?: string;
    username?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    customStatus?: string;
    bio?: string;
    status?: User['status'];
  }) =>
    apiClient.request<{ user: User }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Users API
export const userApi = {
  searchUsers: (query: string) =>
    apiClient.request<{ users: User[] }>(`/users/search?q=${encodeURIComponent(query)}`),

  getUserById: (id: string) => apiClient.request<{ user: User }>(`/users/${id}`),
};

// Friends & Social API
export const friendsApi = {
  getFriends: () =>
    apiClient.request<{ friends: Friend[]; requests: { sent: FriendRequest[]; received: FriendRequest[] } }>(
      '/friends'
    ),

  sendRequest: (targetUsername: string) =>
    apiClient.request<{ request: FriendRequest; message: string }>('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetUsername }),
    }),

  acceptRequest: (requestId: string) =>
    apiClient.request<{ request: FriendRequest; success: boolean }>(`/friends/accept/${requestId}`, {
      method: 'POST',
    }),

  rejectRequest: (requestId: string) =>
    apiClient.request<{ success: boolean }>(`/friends/reject/${requestId}`, {
      method: 'POST',
    }),

  removeFriend: (friendId: string) =>
    apiClient.request<{ success: boolean }>(`/friends/${friendId}`, {
      method: 'DELETE',
    }),
};

// Direct Messages (DMs) API
export const dmApi = {
  getDMChannels: () => apiClient.request<{ channels: DMChannel[] }>('/dms'),

  openDM: (recipientId: string) =>
    apiClient.request<{ channel: DMChannel }>('/dms/open', {
      method: 'POST',
      body: JSON.stringify({ recipientId }),
    }),

  getDMMessages: (dmChannelId: string) =>
    apiClient.request<{ messages: DirectMessage[] }>(`/dms/${dmChannelId}/messages`),

  sendDMMessage: (dmChannelId: string, content: string, attachments?: string[]) =>
    apiClient.request<{ message: DirectMessage }>(`/dms/${dmChannelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, attachments }),
    }),
};

// Server API & Moderation
export const serverApi = {
  getServers: () => apiClient.request<{ servers: Server[] }>('/servers'),

  getServerById: (id: string) => apiClient.request<{ server: Server }>(`/servers/${id}`),

  createServer: (data: { name: string; description?: string; iconUrl?: string }) =>
    apiClient.request<{ server: Server }>('/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateServer: (id: string, data: { name?: string; description?: string; iconUrl?: string }) =>
    apiClient.request<{ server: Server }>(`/servers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteServer: (id: string) =>
    apiClient.request<{ success: boolean }>(`/servers/${id}`, {
      method: 'DELETE',
    }),

  // Roles
  getRoles: (serverId: string) =>
    apiClient.request<{ roles: Role[] }>(`/servers/${serverId}/roles`),

  createRole: (serverId: string, data: { name: string; color?: string; permissions?: Permission[] }) =>
    apiClient.request<{ role: Role }>(`/servers/${serverId}/roles`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRole: (
    serverId: string,
    roleId: string,
    data: { name?: string; color?: string; permissions?: Permission[]; position?: number }
  ) =>
    apiClient.request<{ role: Role }>(`/servers/${serverId}/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteRole: (serverId: string, roleId: string) =>
    apiClient.request<{ success: boolean }>(`/servers/${serverId}/roles/${roleId}`, {
      method: 'DELETE',
    }),

  assignRole: (serverId: string, userId: string, roleId: string) =>
    apiClient.request<{ member: ServerMember }>(`/servers/${serverId}/members/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleId }),
    }),

  removeRole: (serverId: string, userId: string, roleId: string) =>
    apiClient.request<{ member: ServerMember }>(`/servers/${serverId}/members/${userId}/roles/${roleId}`, {
      method: 'DELETE',
    }),

  // Moderation
  kickMember: (serverId: string, userId: string) =>
    apiClient.request<{ success: boolean; message: string }>(`/servers/${serverId}/members/${userId}/kick`, {
      method: 'POST',
    }),

  banMember: (serverId: string, userId: string, reason?: string) =>
    apiClient.request<{ success: boolean; ban: ServerBan; message: string }>(
      `/servers/${serverId}/members/${userId}/ban`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    ),

  unbanMember: (serverId: string, userId: string) =>
    apiClient.request<{ success: boolean; message: string }>(`/servers/${serverId}/bans/${userId}`, {
      method: 'DELETE',
    }),

  getBans: (serverId: string) =>
    apiClient.request<{ bans: ServerBan[] }>(`/servers/${serverId}/bans`),
};

// Channel API
export const channelApi = {
  createChannel: (serverId: string, data: { name: string; type: 'TEXT' | 'VOICE'; topic?: string }) =>
    apiClient.request<{ channel: Channel }>(`/servers/${serverId}/channels`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateChannel: (channelId: string, data: { name?: string; topic?: string }) =>
    apiClient.request<{ channel: Channel }>(`/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteChannel: (channelId: string) =>
    apiClient.request<{ success: boolean }>(`/channels/${channelId}`, {
      method: 'DELETE',
    }),
};

// Message API
export const messageApi = {
  getMessages: (channelId: string) =>
    apiClient.request<{ messages: Message[] }>(`/channels/${channelId}/messages`),

  sendMessage: (channelId: string, content: string, attachments?: string[]) =>
    apiClient.request<{ message: Message }>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, attachments }),
    }),

  toggleReaction: (messageId: string, emoji: string) =>
    apiClient.request<{ message: Message }>(`/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  deleteMessage: (messageId: string) =>
    apiClient.request<{ success: boolean }>(`/messages/${messageId}`, {
      method: 'DELETE',
    }),
};

// Invite API
export const inviteApi = {
  createInvite: (serverId: string, maxUses = 0, expiresInHours = 24) =>
    apiClient.request<{ invite: Invite }>(`/servers/${serverId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ maxUses, expiresInHours }),
    }),

  getInvite: (code: string) =>
    apiClient.request<{ invite: Invite; server: Partial<Server> }>(`/invites/${code}`),

  joinInvite: (code: string) =>
    apiClient.request<{ server: Server }>(`/invites/${code}/join`, {
      method: 'POST',
    }),
};

// Notification API
export const notificationApi = {
  getNotifications: () =>
    apiClient.request<{ notifications: Notification[]; unreadCount: number }>('/notifications'),

  markAsRead: (id: string) =>
    apiClient.request<{ notification: Notification; success: boolean }>(`/notifications/${id}/read`, {
      method: 'POST',
    }),

  markAllAsRead: () =>
    apiClient.request<{ success: boolean; message: string }>('/notifications/read-all', {
      method: 'POST',
    }),

  deleteNotification: (id: string) =>
    apiClient.request<{ success: boolean }>(`/notifications/${id}`, {
      method: 'DELETE',
    }),
};

// File Upload Service & API
export const uploadApi = {
  validateFile: (file: File): { valid: boolean; error?: string } => {
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_SIZE) {
      return { valid: false, error: 'O tamanho do arquivo excede o limite máximo de 25MB.' };
    }

    const allowedMimes = [
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
    ];

    const isAllowed =
      allowedMimes.includes(file.type) ||
      file.type.startsWith('image/') ||
      file.type.startsWith('audio/') ||
      file.type.startsWith('video/');

    if (!isAllowed) {
      return { valid: false, error: `Formato de arquivo não suportado (${file.type || 'desconhecido'}).` };
    }

    return { valid: true };
  },

  uploadFile: async (file: File): Promise<{ url: string; filename: string; size: number; mimetype: string }> => {
    const validation = uploadApi.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Arquivo inválido.');
    }

    const formData = new FormData();
    formData.append('file', file);
    return apiClient.request('/upload', {
      method: 'POST',
      body: formData,
    });
  },
};

// User presence update API
export const userPresenceApi = {
  updatePresencePreference: (status: PresenceStatus, customStatus?: string) =>
    apiClient.request<{ user: User; presenceStatus: PresenceStatus }>('/users/me/presence', {
      method: 'PATCH',
      body: JSON.stringify({ status, customStatus }),
    }),
};

// WebRTC API
export const webrtcApi = {
  getIceConfig: () => apiClient.request<WebRTCConfig>('/webrtc/config'),
};
