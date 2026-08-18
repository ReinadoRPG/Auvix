import { io, Socket } from 'socket.io-client';
import { Message, VoiceParticipant, UserStatus } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private currentToken: string | null = null;

  public connect(token: string) {
    if (this.socket && this.currentToken === token && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.currentToken = token;
    this.socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[Auvix Socket] Connected to real-time server:', this.socket?.id);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Auvix Socket] Connection error:', err.message);
    });

    return this.socket;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  // --- Presence ---
  public setPresence(status: UserStatus, customStatus?: string) {
    this.socket?.emit('set-presence', { status, customStatus });
  }

  // --- Text Channels ---
  public joinChannel(channelId: string) {
    this.socket?.emit('join-channel', channelId);
  }

  public leaveChannel(channelId: string) {
    this.socket?.emit('leave-channel', channelId);
  }

  public setTyping(channelId: string, isTyping: boolean) {
    this.socket?.emit('typing', { channelId, isTyping });
  }

  public sendMessage(channelId: string, content: string, attachments?: string[]) {
    this.socket?.emit('send-message', { channelId, content, attachments });
  }

  public toggleReaction(messageId: string, channelId: string, emoji: string) {
    this.socket?.emit('message-reaction', { messageId, channelId, emoji });
  }

  public deleteMessage(messageId: string, channelId: string) {
    this.socket?.emit('delete-message', { messageId, channelId });
  }

  // --- Voice & WebRTC ---
  public joinVoice(channelId: string, serverId: string) {
    this.socket?.emit('join-voice', { channelId, serverId });
  }

  public leaveVoice(channelId: string) {
    this.socket?.emit('leave-voice', { channelId });
  }

  public updateVoiceState(data: {
    channelId: string;
    isMuted?: boolean;
    isDeafened?: boolean;
    isCameraOn?: boolean;
    isScreenSharing?: boolean;
  }) {
    this.socket?.emit('voice-state-update', data);
  }

  public emitSpeaking(channelId: string, isSpeaking: boolean) {
    this.socket?.emit('voice-speaking', { channelId, isSpeaking });
  }

  public sendOffer(targetUserId: string, channelId: string, offer: RTCSessionDescriptionInit) {
    this.socket?.emit('webrtc-offer', { targetUserId, channelId, offer });
  }

  public sendAnswer(targetUserId: string, channelId: string, answer: RTCSessionDescriptionInit) {
    this.socket?.emit('webrtc-answer', { targetUserId, channelId, answer });
  }

  public sendIceCandidate(targetUserId: string, channelId: string, candidate: RTCIceCandidateInit) {
    this.socket?.emit('webrtc-ice-candidate', { targetUserId, channelId, candidate });
  }
}

export const socketService = new SocketService();
