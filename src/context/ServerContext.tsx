import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Server, Channel, Message, ServerMember, Invite } from '../types';
import { useAuth } from './AuthContext';
import { serverApi, channelApi, messageApi, inviteApi } from '../services/api';
import { socketService } from '../services/socket';

interface TypingUser {
  userId: string;
  username: string;
}

interface ServerContextType {
  servers: Server[];
  activeServer: Server | null;
  activeChannel: Channel | null;
  serverMembers: ServerMember[];
  messages: Message[];
  loadingMessages: boolean;
  typingUsers: TypingUser[];
  loadServers: () => Promise<void>;
  selectServer: (server: Server | string) => Promise<void>;
  selectChannel: (channel: Channel | string) => Promise<void>;
  createServer: (name: string, description?: string, iconUrl?: string) => Promise<Server>;
  updateServer: (id: string, data: { name?: string; description?: string; iconUrl?: string }) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  createChannel: (name: string, type: 'TEXT' | 'VOICE', topic?: string) => Promise<Channel>;
  deleteChannel: (id: string) => Promise<void>;
  sendMessage: (content: string, attachments?: string[]) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  createInvite: (serverId: string, maxUses?: number, expiresInHours?: number) => Promise<Invite>;
  joinInvite: (code: string) => Promise<Server>;
  sendTyping: (isTyping: boolean) => void;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [serverMembers, setServerMembers] = useState<ServerMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const loadServers = useCallback(async () => {
    if (!user) return;
    try {
      const { servers: srvs } = await serverApi.getServers();
      setServers(srvs);

      // If no active server, select first
      if (srvs.length > 0 && !activeServer) {
        selectServer(srvs[0]);
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    }
  }, [user, activeServer]);

  useEffect(() => {
    if (user) {
      loadServers();
    } else {
      setServers([]);
      setActiveServer(null);
      setActiveChannel(null);
      setMessages([]);
    }
  }, [user]);

  // Load server details and default channel when server is selected
  const selectServer = async (serverOrId: Server | string) => {
    const srvId = typeof serverOrId === 'string' ? serverOrId : serverOrId.id;
    try {
      const { server } = await serverApi.getServerById(srvId);
      setActiveServer(server);
      setServerMembers(server.members || []);

      // Automatically select the first text channel or first channel
      const defaultChannel = server.channels.find(c => c.type === 'TEXT') || server.channels[0];
      if (defaultChannel) {
        selectChannel(defaultChannel);
      }
    } catch (err) {
      console.error('Failed to select server:', err);
    }
  };

  const selectChannel = async (channelOrId: Channel | string) => {
    const targetChannel = typeof channelOrId === 'string'
      ? activeServer?.channels.find(c => c.id === channelOrId) || null
      : channelOrId;

    if (!targetChannel) return;

    // Leave old channel socket room
    if (activeChannel) {
      socketService.leaveChannel(activeChannel.id);
    }

    setActiveChannel(targetChannel);
    setTypingUsers([]);

    if (targetChannel.type === 'TEXT') {
      setLoadingMessages(true);
      socketService.joinChannel(targetChannel.id);
      try {
        const { messages: msgs } = await messageApi.getMessages(targetChannel.id);
        setMessages(msgs);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    }
  };

  // Socket real-time chat listeners
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      if (activeChannel && msg.channelId === activeChannel.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleReactionUpdated = (updatedMsg: Message) => {
      setMessages(prev =>
        prev.map(m => (m.id === updatedMsg.id ? updatedMsg : m))
      );
    };

    const handleMessageDeleted = (data: { messageId: string; channelId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId));
    };

    const handleUserTyping = (data: { channelId: string; userId: string; username: string; isTyping: boolean }) => {
      if (activeChannel?.id !== data.channelId || data.userId === user?.id) return;

      setTypingUsers(prev => {
        if (data.isTyping) {
          if (prev.some(u => u.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, username: data.username }];
        } else {
          return prev.filter(u => u.userId !== data.userId);
        }
      });
    };

    const handlePresenceChanged = (data: { userId: string; status: any; customStatus?: string }) => {
      setServerMembers(prev =>
        prev.map(m => {
          if (m.userId === data.userId) {
            return {
              ...m,
              user: {
                ...m.user,
                status: data.status,
                customStatus: data.customStatus ?? m.user.customStatus,
              },
            };
          }
          return m;
        })
      );
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-reaction-updated', handleReactionUpdated);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-presence-changed', handlePresenceChanged);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('message-reaction-updated', handleReactionUpdated);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-presence-changed', handlePresenceChanged);
    };
  }, [activeChannel, user]);

  const createServer = async (name: string, description?: string, iconUrl?: string): Promise<Server> => {
    const { server } = await serverApi.createServer({ name, description, iconUrl });
    setServers(prev => [...prev, server]);
    await selectServer(server);
    return server;
  };

  const updateServer = async (id: string, data: { name?: string; description?: string; iconUrl?: string }) => {
    const { server } = await serverApi.updateServer(id, data);
    setServers(prev => prev.map(s => (s.id === id ? server : s)));
    if (activeServer?.id === id) {
      setActiveServer(server);
    }
  };

  const deleteServer = async (id: string) => {
    await serverApi.deleteServer(id);
    setServers(prev => prev.filter(s => s.id !== id));
    if (activeServer?.id === id) {
      const remaining = servers.filter(s => s.id !== id);
      if (remaining.length > 0) {
        selectServer(remaining[0]);
      } else {
        setActiveServer(null);
        setActiveChannel(null);
        setMessages([]);
      }
    }
  };

  const createChannel = async (name: string, type: 'TEXT' | 'VOICE', topic?: string): Promise<Channel> => {
    if (!activeServer) throw new Error('Nenhum servidor selecionado');
    const { channel } = await channelApi.createChannel(activeServer.id, { name, type, topic });

    const updatedServer = {
      ...activeServer,
      channels: [...activeServer.channels, channel],
    };
    setActiveServer(updatedServer);
    setServers(prev => prev.map(s => (s.id === activeServer.id ? updatedServer : s)));

    if (type === 'TEXT') {
      selectChannel(channel);
    }
    return channel;
  };

  const deleteChannel = async (id: string) => {
    if (!activeServer) return;
    await channelApi.deleteChannel(id);
    const updatedChannels = activeServer.channels.filter(c => c.id !== id);
    const updatedServer = { ...activeServer, channels: updatedChannels };
    setActiveServer(updatedServer);
    setServers(prev => prev.map(s => (s.id === activeServer.id ? updatedServer : s)));

    if (activeChannel?.id === id) {
      const remainingText = updatedChannels.find(c => c.type === 'TEXT');
      if (remainingText) selectChannel(remainingText);
      else setActiveChannel(null);
    }
  };

  const sendMessage = async (content: string, attachments?: string[]) => {
    if (!activeChannel || !user) return;
    socketService.sendMessage(activeChannel.id, content, attachments);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!activeChannel) return;
    socketService.toggleReaction(messageId, activeChannel.id, emoji);
  };

  const deleteMessage = async (messageId: string) => {
    if (!activeChannel) return;
    socketService.deleteMessage(messageId, activeChannel.id);
  };

  const createInvite = async (serverId: string, maxUses = 0, expiresInHours = 24): Promise<Invite> => {
    const { invite } = await inviteApi.createInvite(serverId, maxUses, expiresInHours);
    return invite;
  };

  const joinInvite = async (code: string): Promise<Server> => {
    const { server } = await inviteApi.joinInvite(code);
    await loadServers();
    await selectServer(server);
    return server;
  };

  const sendTyping = (isTyping: boolean) => {
    if (activeChannel) {
      socketService.setTyping(activeChannel.id, isTyping);
    }
  };

  return (
    <ServerContext.Provider
      value={{
        servers,
        activeServer,
        activeChannel,
        serverMembers,
        messages,
        loadingMessages,
        typingUsers,
        loadServers,
        selectServer,
        selectChannel,
        createServer,
        updateServer,
        deleteServer,
        createChannel,
        deleteChannel,
        sendMessage,
        toggleReaction,
        deleteMessage,
        createInvite,
        joinInvite,
        sendTyping,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = () => {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error('useServer must be used within a ServerProvider');
  }
  return context;
};
