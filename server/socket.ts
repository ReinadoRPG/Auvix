import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from './auth';
import { db } from './db';
import { VoiceParticipant, UserStatus } from '../src/types';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

export function setupSocketIO(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Map: userId -> Set<socketId>
  const userSockets = new Map<string, Set<string>>();
  // Map: socketId -> userId
  const socketToUser = new Map<string, string>();
  // Map: channelId -> Map<userId, VoiceParticipant>
  const voiceRooms = new Map<string, Map<string, VoiceParticipant>>();
  // Map: socketId -> channelId (current voice room)
  const socketToVoiceChannel = new Map<string, string>();

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication token required'));
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return next(new Error('Invalid or expired token'));
    }

    const user = db.findUserById(payload.userId);
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user.id;
    socket.user = user;
    next();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const user = socket.user;

    // Track user socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    socketToUser.set(socket.id, userId);

    // Retrieve user's stored persistent presence preference
    const storedUser = db.findUserById(userId) || user;
    const persistentPresence = storedUser.presenceStatus || (storedUser.status !== 'OFFLINE' ? storedUser.status : 'ONLINE');

    // If preference is INVISIBLE, display as OFFLINE to others, but keep user marked as INVISIBLE internally
    const effectiveDisplayStatus = persistentPresence === 'INVISIBLE' ? 'OFFLINE' : persistentPresence;
    db.updateUserStatus(userId, effectiveDisplayStatus as any);

    // Broadcast presence update to others
    io.emit('user-presence-changed', {
      userId,
      status: effectiveDisplayStatus,
      presenceStatus: persistentPresence,
      customStatus: storedUser.customStatus,
    });

    // Send the user their own persisted presence state
    socket.emit('presence-init', {
      userId,
      presenceStatus: persistentPresence,
      status: persistentPresence,
      customStatus: storedUser.customStatus,
    });

    // Join user's personal room for direct notifications
    socket.join(`user:${userId}`);

    // Send initial active voice participants overview across all channels
    const activeVoiceState: Record<string, VoiceParticipant[]> = {};
    voiceRooms.forEach((participants, channelId) => {
      activeVoiceState[channelId] = Array.from(participants.values());
    });
    socket.emit('voice-global-state', activeVoiceState);

    // ==========================================
    // PRESENCE
    // ==========================================
    socket.on('set-presence', (data: { status: any; customStatus?: string }) => {
      const normalizedStatus = data.status === 'DND' ? 'DO_NOT_DISTURB' : data.status;
      const updated = db.setUserPresencePreference(userId, normalizedStatus, data.customStatus);
      if (updated) {
        const displayStatus = normalizedStatus === 'INVISIBLE' ? 'OFFLINE' : normalizedStatus;
        
        // Broadcast to all
        io.emit('user-presence-changed', {
          userId,
          status: displayStatus,
          presenceStatus: normalizedStatus,
          customStatus: updated.customStatus,
        });

        // Confirm to user's sockets
        io.to(`user:${userId}`).emit('presence-updated', {
          userId,
          presenceStatus: normalizedStatus,
          status: normalizedStatus,
          customStatus: updated.customStatus,
        });
      }
    });

    // ==========================================
    // TEXT CHANNELS & REAL-TIME CHAT
    // ==========================================
    socket.on('join-channel', (channelId: string) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on('leave-channel', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('typing', (data: { channelId: string; isTyping: boolean }) => {
      socket.to(`channel:${data.channelId}`).emit('user-typing', {
        channelId: data.channelId,
        userId,
        username: user.username,
        displayName: user.displayName || user.username,
        isTyping: data.isTyping,
      });
    });

    socket.on('send-message', (data: { channelId: string; content: string; attachments?: string[] }) => {
      try {
        const { message, notifications } = db.createMessage(data.channelId, userId, data.content, data.attachments);
        io.to(`channel:${data.channelId}`).emit('new-message', message);

        // Real-time delivery of notifications to mentioned users
        for (const notif of notifications) {
          io.to(`user:${notif.userId}`).emit('notification-created', notif);
        }
      } catch (err: any) {
        socket.emit('error-message', { message: err.message || 'Falha ao enviar mensagem.' });
      }
    });

    socket.on('message-reaction', (data: { messageId: string; channelId: string; emoji: string }) => {
      try {
        const updatedMsg = db.toggleMessageReaction(data.messageId, userId, data.emoji);
        if (updatedMsg) {
          io.to(`channel:${data.channelId}`).emit('message-reaction-updated', updatedMsg);
        }
      } catch (err) {
        console.error('Error toggling reaction:', err);
      }
    });

    socket.on('delete-message', (data: { messageId: string; channelId: string }) => {
      try {
        const ok = db.deleteMessage(data.messageId, userId);
        if (ok) {
          io.to(`channel:${data.channelId}`).emit('message-deleted', { messageId: data.messageId, channelId: data.channelId });
        }
      } catch (err) {
        console.error('Error deleting message:', err);
      }
    });

    // ==========================================
    // DIRECT MESSAGES (DMs)
    // ==========================================
    socket.on('join-dm', (dmChannelId: string) => {
      socket.join(`dm:${dmChannelId}`);
    });

    socket.on('leave-dm', (dmChannelId: string) => {
      socket.leave(`dm:${dmChannelId}`);
    });

    socket.on('dm-typing', (data: { dmChannelId: string; isTyping: boolean }) => {
      socket.to(`dm:${data.dmChannelId}`).emit('dm-user-typing', {
        dmChannelId: data.dmChannelId,
        userId,
        username: user.username,
        displayName: user.displayName || user.username,
        isTyping: data.isTyping,
      });
    });

    socket.on('send-dm-message', (data: { dmChannelId: string; content: string; attachments?: string[]; recipientId?: string }) => {
      try {
        const msg = db.createDMMessage(data.dmChannelId, userId, data.content, data.attachments);
        io.to(`dm:${data.dmChannelId}`).emit('new-dm-message', msg);
        if (data.recipientId) {
          io.to(`user:${data.recipientId}`).emit('dm-notification', {
            dmChannelId: data.dmChannelId,
            message: msg,
          });
        }
      } catch (err: any) {
        socket.emit('error-message', { message: err.message || 'Falha ao enviar mensagem direta.' });
      }
    });

    // ==========================================
    // FRIENDS NOTIFICATIONS
    // ==========================================
    socket.on('notify-friend-request', (data: { targetUserId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('friend-request-received', {
        fromUser: user,
      });
    });


    // ==========================================
    // REAL-TIME VOICE, VIDEO & SCREEN SHARE
    // ==========================================

    socket.on('join-voice', (data: { channelId: string; serverId: string }) => {
      const { channelId, serverId } = data;

      // If user was in another voice channel, leave first
      const currentVoiceChannel = socketToVoiceChannel.get(socket.id);
      if (currentVoiceChannel && currentVoiceChannel !== channelId) {
        leaveVoiceRoom(socket, currentVoiceChannel);
      }

      if (!voiceRooms.has(channelId)) {
        voiceRooms.set(channelId, new Map());
      }

      const room = voiceRooms.get(channelId)!;
      const participant: VoiceParticipant = {
        userId,
        user,
        channelId,
        serverId,
        socketId: socket.id,
        isMuted: false,
        isDeafened: false,
        isCameraOn: false,
        isScreenSharing: false,
        isSpeaking: false,
        joinedAt: new Date().toISOString(),
      };

      room.set(userId, participant);
      socketToVoiceChannel.set(socket.id, channelId);
      socket.join(`voice:${channelId}`);

      // Send existing participants to the joined user
      const existingParticipants = Array.from(room.values()).filter(p => p.userId !== userId);
      socket.emit('voice-room-users', {
        channelId,
        participants: existingParticipants,
      });

      // Broadcast to others in the room and whole server
      socket.to(`voice:${channelId}`).emit('voice-user-joined', participant);
      io.emit('voice-channel-updated', {
        channelId,
        participants: Array.from(room.values()),
      });
    });

    socket.on('leave-voice', (data: { channelId: string }) => {
      leaveVoiceRoom(socket, data.channelId);
    });

    // WebRTC Signaling: Offer
    socket.on('webrtc-offer', (data: { targetUserId: string; channelId: string; offer: any }) => {
      const targetSockets = userSockets.get(data.targetUserId);
      if (targetSockets) {
        targetSockets.forEach(targetSocketId => {
          io.to(targetSocketId).emit('webrtc-offer', {
            fromUserId: userId,
            channelId: data.channelId,
            offer: data.offer,
          });
        });
      }
    });

    // WebRTC Signaling: Answer
    socket.on('webrtc-answer', (data: { targetUserId: string; channelId: string; answer: any }) => {
      const targetSockets = userSockets.get(data.targetUserId);
      if (targetSockets) {
        targetSockets.forEach(targetSocketId => {
          io.to(targetSocketId).emit('webrtc-answer', {
            fromUserId: userId,
            channelId: data.channelId,
            answer: data.answer,
          });
        });
      }
    });

    // WebRTC Signaling: ICE Candidate
    socket.on('webrtc-ice-candidate', (data: { targetUserId: string; channelId: string; candidate: any }) => {
      const targetSockets = userSockets.get(data.targetUserId);
      if (targetSockets) {
        targetSockets.forEach(targetSocketId => {
          io.to(targetSocketId).emit('webrtc-ice-candidate', {
            fromUserId: userId,
            channelId: data.channelId,
            candidate: data.candidate,
          });
        });
      }
    });

    // Voice & Media State Changes (Mute, Deafen, Camera, Screen Share)
    socket.on('voice-state-update', (data: {
      channelId: string;
      isMuted?: boolean;
      isDeafened?: boolean;
      isCameraOn?: boolean;
      isScreenSharing?: boolean;
    }) => {
      const room = voiceRooms.get(data.channelId);
      if (room && room.has(userId)) {
        const participant = room.get(userId)!;
        if (data.isMuted !== undefined) participant.isMuted = data.isMuted;
        if (data.isDeafened !== undefined) participant.isDeafened = data.isDeafened;
        if (data.isCameraOn !== undefined) participant.isCameraOn = data.isCameraOn;
        if (data.isScreenSharing !== undefined) participant.isScreenSharing = data.isScreenSharing;

        io.to(`voice:${data.channelId}`).emit('voice-state-changed', participant);
        io.emit('voice-channel-updated', {
          channelId: data.channelId,
          participants: Array.from(room.values()),
        });
      }
    });

    // Speaking Activity Indicator
    socket.on('voice-speaking', (data: { channelId: string; isSpeaking: boolean }) => {
      const room = voiceRooms.get(data.channelId);
      if (room && room.has(userId)) {
        const participant = room.get(userId)!;
        participant.isSpeaking = data.isSpeaking;
        socket.to(`voice:${data.channelId}`).emit('voice-user-speaking', {
          channelId: data.channelId,
          userId,
          isSpeaking: data.isSpeaking,
        });
      }
    });

    // ==========================================
    // DISCONNECT HANDLER
    // ==========================================
    socket.on('disconnect', () => {
      // Leave voice channel if any
      const voiceChannel = socketToVoiceChannel.get(socket.id);
      if (voiceChannel) {
        leaveVoiceRoom(socket, voiceChannel);
      }

      // Remove socket reference
      socketToUser.delete(socket.id);
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
          const latestUser = db.findUserById(userId);
          // Mark user as offline in active connection state
          db.updateUserStatus(userId, 'OFFLINE');
          io.emit('user-presence-changed', {
            userId,
            status: 'OFFLINE',
            presenceStatus: latestUser?.presenceStatus,
            customStatus: latestUser?.customStatus,
          });
        }
      }
    });
  });

  function leaveVoiceRoom(socket: AuthenticatedSocket, channelId: string) {
    const userId = socket.userId!;
    socketToVoiceChannel.delete(socket.id);
    socket.leave(`voice:${channelId}`);

    const room = voiceRooms.get(channelId);
    if (room) {
      room.delete(userId);
      socket.to(`voice:${channelId}`).emit('voice-user-left', {
        channelId,
        userId,
      });

      if (room.size === 0) {
        voiceRooms.delete(channelId);
        io.emit('voice-channel-updated', { channelId, participants: [] });
      } else {
        io.emit('voice-channel-updated', {
          channelId,
          participants: Array.from(room.values()),
        });
      }
    }
  }

  return io;
}
