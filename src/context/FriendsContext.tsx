import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Friend, FriendRequest, DMChannel, DirectMessage, User } from '../types';
import { useAuth } from './AuthContext';
import { friendsApi, dmApi } from '../services/api';
import { socketService } from '../services/socket';
import { audioEffects } from '../services/audioEffects';

interface FriendsContextType {
  friends: Friend[];
  pendingReceived: FriendRequest[];
  pendingSent: FriendRequest[];
  dmChannels: DMChannel[];
  activeDM: DMChannel | null;
  dmMessages: DirectMessage[];
  loadingDMs: boolean;
  activeProfileUser: User | null;
  loadFriendsAndDMs: () => Promise<void>;
  sendFriendRequest: (targetUsername: string) => Promise<string>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  openDM: (recipientId: string) => Promise<DMChannel>;
  selectDM: (channel: DMChannel | null) => Promise<void>;
  sendDMMessage: (content: string, attachments?: string[]) => Promise<void>;
  openUserProfile: (user: User | null) => void;
  closeUserProfile: () => void;
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

export const FriendsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendRequest[]>([]);
  const [dmChannels, setDmChannels] = useState<DMChannel[]>([]);
  const [activeDM, setActiveDM] = useState<DMChannel | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [loadingDMs, setLoadingDMs] = useState<boolean>(false);
  const [activeProfileUser, setActiveProfileUser] = useState<User | null>(null);

  const loadFriendsAndDMs = useCallback(async () => {
    if (!user) return;
    try {
      const [friendsRes, dmsRes] = await Promise.all([
        friendsApi.getFriends(),
        dmApi.getDMChannels(),
      ]);

      setFriends(friendsRes.friends || []);
      setPendingReceived(friendsRes.requests?.received || []);
      setPendingSent(friendsRes.requests?.sent || []);
      setDmChannels(dmsRes.channels || []);
    } catch (err) {
      console.error('Error loading friends/DMs:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadFriendsAndDMs();
    } else {
      setFriends([]);
      setPendingReceived([]);
      setPendingSent([]);
      setDmChannels([]);
      setActiveDM(null);
      setDmMessages([]);
    }
  }, [user, loadFriendsAndDMs]);

  // Real-time socket events for DMs and Friends
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !user) return;

    const handleNewDMMessage = (msg: DirectMessage) => {
      if (activeDM && msg.dmChannelId === activeDM.id) {
        setDmMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      // Update channel preview and unread count
      setDmChannels((prev) =>
        prev.map((c) => {
          if (c.id === msg.dmChannelId) {
            return {
              ...c,
              lastMessage: msg,
              unreadCount: activeDM?.id === msg.dmChannelId ? 0 : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );

      if (msg.authorId !== user.id) {
        audioEffects.playNotification();
      }
    };

    const handleFriendRequestReceived = () => {
      loadFriendsAndDMs();
      audioEffects.playNotification();
    };

    const handlePresenceChanged = (data: { userId: string; status: any; customStatus?: string }) => {
      setFriends((prev) =>
        prev.map((f) => {
          if (f.user.id === data.userId) {
            return {
              ...f,
              user: {
                ...f.user,
                status: data.status,
                customStatus: data.customStatus ?? f.user.customStatus,
              },
            };
          }
          return f;
        })
      );

      setDmChannels((prev) =>
        prev.map((c) => {
          if (c.recipient.id === data.userId) {
            return {
              ...c,
              recipient: {
                ...c.recipient,
                status: data.status,
                customStatus: data.customStatus ?? c.recipient.customStatus,
              },
            };
          }
          return c;
        })
      );
    };

    socket.on('new-dm-message', handleNewDMMessage);
    socket.on('friend-request-received', handleFriendRequestReceived);
    socket.on('user-presence-changed', handlePresenceChanged);

    return () => {
      socket.off('new-dm-message', handleNewDMMessage);
      socket.off('friend-request-received', handleFriendRequestReceived);
      socket.off('user-presence-changed', handlePresenceChanged);
    };
  }, [activeDM, user, loadFriendsAndDMs]);

  const sendFriendRequest = async (targetUsername: string): Promise<string> => {
    const res = await friendsApi.sendRequest(targetUsername);
    await loadFriendsAndDMs();

    const socket = socketService.getSocket();
    if (socket && res.request) {
      socket.emit('notify-friend-request', { targetUserId: res.request.receiverId });
    }

    return res.message;
  };

  const acceptFriendRequest = async (requestId: string) => {
    await friendsApi.acceptRequest(requestId);
    await loadFriendsAndDMs();
  };

  const rejectFriendRequest = async (requestId: string) => {
    await friendsApi.rejectRequest(requestId);
    await loadFriendsAndDMs();
  };

  const removeFriend = async (friendId: string) => {
    await friendsApi.removeFriend(friendId);
    await loadFriendsAndDMs();
  };

  const openDM = async (recipientId: string): Promise<DMChannel> => {
    const { channel } = await dmApi.openDM(recipientId);
    setDmChannels((prev) => {
      if (prev.some((c) => c.id === channel.id)) {
        return prev.map((c) => (c.id === channel.id ? channel : c));
      }
      return [channel, ...prev];
    });
    await selectDM(channel);
    return channel;
  };

  const selectDM = async (channel: DMChannel | null) => {
    const socket = socketService.getSocket();
    if (activeDM && socket) {
      socket.emit('leave-dm', activeDM.id);
    }

    setActiveDM(channel);
    if (!channel) {
      setDmMessages([]);
      return;
    }

    if (socket) {
      socket.emit('join-dm', channel.id);
    }

    setLoadingDMs(true);
    try {
      const { messages } = await dmApi.getDMMessages(channel.id);
      setDmMessages(messages);
      // Reset unread count
      setDmChannels((prev) =>
        prev.map((c) => (c.id === channel.id ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      console.error('Error fetching DM messages:', err);
    } finally {
      setLoadingDMs(false);
    }
  };

  const sendDMMessage = async (content: string, attachments?: string[]) => {
    if (!activeDM || !user) return;
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('send-dm-message', {
        dmChannelId: activeDM.id,
        content,
        attachments,
        recipientId: activeDM.recipientId,
      });
    } else {
      const { message } = await dmApi.sendDMMessage(activeDM.id, content, attachments);
      setDmMessages((prev) => [...prev, message]);
    }
  };

  const openUserProfile = (targetUser: User | null) => {
    setActiveProfileUser(targetUser);
  };

  const closeUserProfile = () => {
    setActiveProfileUser(null);
  };

  return (
    <FriendsContext.Provider
      value={{
        friends,
        pendingReceived,
        pendingSent,
        dmChannels,
        activeDM,
        dmMessages,
        loadingDMs,
        activeProfileUser,
        loadFriendsAndDMs,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        removeFriend,
        openDM,
        selectDM,
        sendDMMessage,
        openUserProfile,
        closeUserProfile,
      }}
    >
      {children}
    </FriendsContext.Provider>
  );
};

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used within a FriendsProvider');
  }
  return context;
};
