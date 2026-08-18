import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Channel, Server, VoiceParticipant } from '../types';
import { useAuth } from './AuthContext';
import { socketService } from '../services/socket';
import { webrtcManager } from '../services/webrtc';
import { audioEffects } from '../services/audioEffects';

interface VoiceContextType {
  activeVoiceChannel: Channel | null;
  activeVoiceServer: Server | null;
  participants: VoiceParticipant[];
  remoteStreams: Map<string, MediaStream>;
  localAudioStream: MediaStream | null;
  localVideoStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  globalVoiceChannels: Record<string, VoiceParticipant[]>;
  joinVoice: (channel: Channel, server: Server) => Promise<void>;
  leaveVoice: () => void;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<Channel | null>(null);
  const [activeVoiceServer, setActiveVoiceServer] = useState<Server | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [globalVoiceChannels, setGlobalVoiceChannels] = useState<Record<string, VoiceParticipant[]>>({});

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);

  // Keep ref for active voice channel to use in socket listeners
  const activeChannelRef = useRef<Channel | null>(null);
  activeChannelRef.current = activeVoiceChannel;

  // Initialize WebRTC
  useEffect(() => {
    webrtcManager.init();

    webrtcManager.setCallbacks({
      onRemoteStreamAdd: (remoteUserId, stream) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteUserId, stream);
          return next;
        });
      },
      onRemoteStreamRemove: (remoteUserId) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(remoteUserId);
          return next;
        });
      },
      onSpeakingChange: (speaking) => {
        setIsSpeaking(speaking);
      },
    });
  }, []);

  // Socket listener bindings for voice & signaling
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleGlobalVoiceState = (state: Record<string, VoiceParticipant[]>) => {
      setGlobalVoiceChannels(state);
    };

    const handleVoiceChannelUpdated = (data: { channelId: string; participants: VoiceParticipant[] }) => {
      setGlobalVoiceChannels((prev) => ({
        ...prev,
        [data.channelId]: data.participants,
      }));

      if (activeChannelRef.current && activeChannelRef.current.id === data.channelId) {
        setParticipants(data.participants);
      }
    };

    const handleVoiceRoomUsers = async (data: { channelId: string; participants: VoiceParticipant[] }) => {
      if (activeChannelRef.current?.id !== data.channelId) return;

      if (user) {
        const selfParticipant: VoiceParticipant = {
          userId: user.id,
          user,
          channelId: data.channelId,
          serverId: activeVoiceServer?.id || '',
          socketId: socket.id || '',
          isMuted: false,
          isDeafened: false,
          isCameraOn: false,
          isScreenSharing: false,
          isSpeaking: false,
          joinedAt: new Date().toISOString(),
        };
        setParticipants([selfParticipant, ...data.participants]);
      }

      // Initiate WebRTC mesh connections to all existing room users
      for (const remoteP of data.participants) {
        if (remoteP.userId !== user?.id) {
          await webrtcManager.connectToPeer(remoteP.userId, true);
        }
      }
    };

    const handleVoiceUserJoined = async (newParticipant: VoiceParticipant) => {
      if (activeChannelRef.current?.id !== newParticipant.channelId) return;

      audioEffects.playUserJoined();

      setParticipants((prev) => {
        if (prev.some((p) => p.userId === newParticipant.userId)) return prev;
        return [...prev, newParticipant];
      });
    };

    const handleVoiceUserLeft = (data: { channelId: string; userId: string }) => {
      if (activeChannelRef.current?.id !== data.channelId) return;

      audioEffects.playUserLeft();

      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
      webrtcManager.removePeer(data.userId);
    };

    const handleVoiceStateChanged = (updatedParticipant: VoiceParticipant) => {
      setParticipants((prev) =>
        prev.map((p) => (p.userId === updatedParticipant.userId ? updatedParticipant : p))
      );
    };

    const handleVoiceUserSpeaking = (data: { channelId: string; userId: string; isSpeaking: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.userId === data.userId ? { ...p, isSpeaking: data.isSpeaking } : p))
      );
    };

    const handleWebRTCOffer = async (data: { fromUserId: string; channelId: string; offer: RTCSessionDescriptionInit }) => {
      if (activeChannelRef.current?.id !== data.channelId) return;
      await webrtcManager.handleOffer(data.fromUserId, data.channelId, data.offer);
    };

    const handleWebRTCAnswer = async (data: { fromUserId: string; channelId: string; answer: RTCSessionDescriptionInit }) => {
      if (activeChannelRef.current?.id !== data.channelId) return;
      await webrtcManager.handleAnswer(data.fromUserId, data.answer);
    };

    const handleWebRTCIceCandidate = async (data: { fromUserId: string; channelId: string; candidate: RTCIceCandidateInit }) => {
      if (activeChannelRef.current?.id !== data.channelId) return;
      await webrtcManager.handleIceCandidate(data.fromUserId, data.candidate);
    };

    socket.on('voice-global-state', handleGlobalVoiceState);
    socket.on('voice-channel-updated', handleVoiceChannelUpdated);
    socket.on('voice-room-users', handleVoiceRoomUsers);
    socket.on('voice-user-joined', handleVoiceUserJoined);
    socket.on('voice-user-left', handleVoiceUserLeft);
    socket.on('voice-state-changed', handleVoiceStateChanged);
    socket.on('voice-user-speaking', handleVoiceUserSpeaking);
    socket.on('webrtc-offer', handleWebRTCOffer);
    socket.on('webrtc-answer', handleWebRTCAnswer);
    socket.on('webrtc-ice-candidate', handleWebRTCIceCandidate);

    return () => {
      socket.off('voice-global-state', handleGlobalVoiceState);
      socket.off('voice-channel-updated', handleVoiceChannelUpdated);
      socket.off('voice-room-users', handleVoiceRoomUsers);
      socket.off('voice-user-joined', handleVoiceUserJoined);
      socket.off('voice-user-left', handleVoiceUserLeft);
      socket.off('voice-state-changed', handleVoiceStateChanged);
      socket.off('voice-user-speaking', handleVoiceUserSpeaking);
      socket.off('webrtc-offer', handleWebRTCOffer);
      socket.off('webrtc-answer', handleWebRTCAnswer);
      socket.off('webrtc-ice-candidate', handleWebRTCIceCandidate);
    };
  }, [user, activeVoiceServer]);

  const joinVoice = async (channel: Channel, server: Server) => {
    if (!user) return;

    if (activeVoiceChannel?.id === channel.id) {
      return;
    }

    if (activeVoiceChannel) {
      leaveVoice();
    }

    audioEffects.playJoinVoice();

    setActiveVoiceChannel(channel);
    setActiveVoiceServer(server);
    setIsMuted(false);
    setIsDeafened(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);

    const micStream = await webrtcManager.startVoiceSession(channel.id, user.id);
    setLocalAudioStream(micStream);

    socketService.joinVoice(channel.id, server.id);
  };

  const leaveVoice = () => {
    if (activeVoiceChannel) {
      audioEffects.playLeaveVoice();
    }
    webrtcManager.leaveSession();
    setActiveVoiceChannel(null);
    setActiveVoiceServer(null);
    setParticipants([]);
    setRemoteStreams(new Map());
    setLocalAudioStream(null);
    setLocalVideoStream(null);
    setLocalScreenStream(null);
    setIsMuted(false);
    setIsDeafened(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setIsSpeaking(false);
  };

  const toggleMute = async () => {
    const muted = await webrtcManager.toggleMute();
    setIsMuted(muted);
    if (muted) {
      audioEffects.playMute();
    } else {
      audioEffects.playUnmute();
    }
  };

  const toggleDeafen = () => {
    const deafened = webrtcManager.toggleDeafen();
    setIsDeafened(deafened);
    setIsMuted(webrtcManager.getIsMuted());
    if (deafened) {
      audioEffects.playMute();
    } else {
      audioEffects.playUnmute();
    }
  };

  const toggleCamera = async () => {
    try {
      const cameraOn = await webrtcManager.toggleCamera();
      setIsCameraOn(cameraOn);
      setLocalVideoStream(webrtcManager.getLocalVideoStream());
    } catch (err: any) {
      console.warn('Erro ao alternar câmera:', err);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      webrtcManager.stopScreenShare();
      setIsScreenSharing(false);
      setLocalScreenStream(null);
    } else {
      try {
        const stream = await webrtcManager.startScreenShare();
        setIsScreenSharing(true);
        setLocalScreenStream(stream);
      } catch (err: any) {
        setIsScreenSharing(false);
      }
    }
  };

  return (
    <VoiceContext.Provider
      value={{
        activeVoiceChannel,
        activeVoiceServer,
        participants,
        remoteStreams,
        localAudioStream,
        localVideoStream,
        localScreenStream,
        isMuted,
        isDeafened,
        isCameraOn,
        isScreenSharing,
        isSpeaking,
        globalVoiceChannels,
        joinVoice,
        leaveVoice,
        toggleMute,
        toggleDeafen,
        toggleCamera,
        toggleScreenShare,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};
