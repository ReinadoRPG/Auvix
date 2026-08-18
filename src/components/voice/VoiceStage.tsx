import React, { useState, useEffect, useRef } from 'react';
import { useVoice } from '../../context/VoiceContext';
import { useAuth } from '../../context/AuthContext';
import { useFriends } from '../../context/FriendsContext';
import { VoiceParticipant } from '../../types';
import {
  Mic,
  MicOff,
  Headphones,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// Single Participant Video Card Component
const ParticipantCard: React.FC<{
  participant: VoiceParticipant;
  stream: MediaStream | null;
  isSelf: boolean;
  isSpotlighted: boolean;
  onSpotlight: () => void;
  isDeafenedUser: boolean;
  onOpenProfile: () => void;
}> = ({
  participant,
  stream,
  isSelf,
  isSpotlighted,
  onSpotlight,
  isDeafenedUser,
  onOpenProfile,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current && stream && !isSelf) {
      audioRef.current.srcObject = stream;
      audioRef.current.muted = isDeafenedUser;
    }
  }, [stream, isSelf, isDeafenedUser]);

  const hasVideo = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;

  return (
    <div
      onClick={onSpotlight}
      className={`relative group bg-[#121316] rounded-xl overflow-hidden border transition-all duration-200 flex flex-col items-center justify-center cursor-pointer select-none ${
        participant.isSpeaking
          ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/10'
          : 'border-[#26282E] hover:border-slate-600'
      } ${isSpotlighted ? 'col-span-full row-span-2 min-h-[360px]' : 'min-h-[180px]'}`}
    >
      {/* Remote Audio Track Element (Hidden) */}
      {!isSelf && <audio ref={audioRef} autoPlay playsInline />}

      {/* Video Track if Camera or Screen Share is active */}
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={`w-full h-full object-cover ${
            participant.isCameraOn && isSelf && !participant.isScreenSharing ? '-scale-x-100' : ''
          }`}
        />
      ) : (
        /* Avatar Placeholder with Animated Speaking Waves */
        <div
          className="flex flex-col items-center justify-center p-6 text-center"
          onClick={(e) => {
            e.stopPropagation();
            onOpenProfile();
          }}
        >
          <div className="relative mb-3">
            {participant.isSpeaking && (
              <div className="absolute inset-0 -m-3 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
            )}
            <img
              src={
                participant.user.avatarUrl ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${participant.user.username}`
              }
              alt={participant.user.displayName || participant.user.username}
              className={`w-20 h-20 rounded-full object-cover bg-[#18191D] border-2 transition-transform ${
                participant.isSpeaking ? 'border-emerald-500 scale-105' : 'border-[#26282E]'
              }`}
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-sm font-bold text-slate-200 hover:underline">
            {participant.user.displayName || participant.user.username}
          </span>
          <span className="text-xs font-mono text-zinc-500">
            @{participant.user.username}
          </span>
        </div>
      )}

      {/* Bottom Information & Badges Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="bg-[#0A0A0C]/90 backdrop-blur-md px-2.5 py-1 rounded-md flex items-center gap-1.5 text-xs text-slate-200 border border-[#26282E]">
          <span className="font-semibold truncate max-w-[140px]">
            {participant.user.displayName || participant.user.username}
          </span>
          {participant.isScreenSharing && (
            <span className="bg-[#F27D26]/20 text-[#FF9345] text-[10px] px-1.5 py-0.2 rounded font-semibold">
              Tela compartilhada
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {participant.isMuted && (
            <div className="bg-rose-500/80 p-1.5 rounded-md text-white backdrop-blur-md" title="Mutado">
              <MicOff className="w-3 h-3" />
            </div>
          )}
          {participant.isDeafened && (
            <div className="bg-rose-500/80 p-1.5 rounded-md text-white backdrop-blur-md" title="Ensurdecido">
              <Headphones className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const VoiceStage: React.FC = () => {
  const {
    activeVoiceChannel,
    participants,
    remoteStreams,
    localAudioStream,
    localVideoStream,
    localScreenStream,
    isMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    leaveVoice,
  } = useVoice();
  const { user } = useAuth();
  const { openUserProfile } = useFriends();

  const [spotlightUserId, setSpotlightUserId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sharingParticipant = participants.find((p) => p.isScreenSharing);
    if (sharingParticipant) {
      setSpotlightUserId(sharingParticipant.userId);
    }
  }, [participants]);

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) {
      stageRef.current.requestFullscreen().catch((err) => console.warn('Fullscreen error:', err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.warn('Exit fullscreen error:', err));
      setIsFullscreen(false);
    }
  };

  if (!activeVoiceChannel) return null;

  const getStreamForParticipant = (p: VoiceParticipant): MediaStream | null => {
    if (user && p.userId === user.id) {
      if (isScreenSharing && localScreenStream) return localScreenStream;
      if (isCameraOn && localVideoStream) return localVideoStream;
      return localAudioStream;
    }
    return remoteStreams.get(p.userId) || null;
  };

  return (
    <div
      ref={stageRef}
      className="relative flex-1 h-full bg-[#0A0A0C] flex flex-col overflow-hidden select-none"
    >
      {/* Voice Stage Top Header */}
      <div className="h-12 px-5 bg-[#121316] border-b border-[#1E2024] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-xs text-slate-100">{activeVoiceChannel.name}</span>
          <span className="text-xs text-slate-400 font-medium">
            • {participants.length} {participants.length === 1 ? 'pessoa na chamada' : 'pessoas na chamada'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1E2026] rounded-lg transition cursor-pointer"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Video & Audio Stage Grid */}
      <div className="flex-1 p-4 overflow-y-auto flex items-center justify-center no-scrollbar">
        <div
          className={`w-full h-full max-w-6xl mx-auto grid gap-3 p-2 ${
            participants.length === 1
              ? 'grid-cols-1 max-w-2xl'
              : participants.length === 2
              ? 'grid-cols-1 md:grid-cols-2 max-w-4xl'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {participants.map((p) => {
            const isSelf = user ? p.userId === user.id : false;
            const stream = getStreamForParticipant(p);
            const isSpotlighted = spotlightUserId === p.userId;

            return (
              <ParticipantCard
                key={p.userId}
                participant={p}
                stream={stream}
                isSelf={isSelf}
                isSpotlighted={isSpotlighted}
                onSpotlight={() => setSpotlightUserId(isSpotlighted ? null : p.userId)}
                isDeafenedUser={isDeafened}
                onOpenProfile={() => openUserProfile(p.user)}
              />
            );
          })}
        </div>
      </div>

      {/* FLOATING CONTROLS BAR */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#121316]/95 backdrop-blur-xl border border-[#26282E] shadow-2xl px-4 py-2.5 rounded-xl flex items-center gap-2 z-30">
        {/* Toggle Microphone */}
        <button
          id="voice-stage-mic-btn"
          type="button"
          onClick={toggleMute}
          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 transition cursor-pointer active:scale-95 ${
            isMuted
              ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
              : 'bg-[#18191D] border border-[#26282E] text-slate-200 hover:bg-[#202228]'
          }`}
          title={isMuted ? 'Ativar microfone' : 'Silenciar microfone'}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Toggle Deafen */}
        <button
          id="voice-stage-deafen-btn"
          type="button"
          onClick={toggleDeafen}
          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 transition cursor-pointer active:scale-95 ${
            isDeafened
              ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
              : 'bg-[#18191D] border border-[#26282E] text-slate-200 hover:bg-[#202228]'
          }`}
          title={isDeafened ? 'Desativar áudio geral' : 'Ensurdecer'}
        >
          <Headphones className="w-4 h-4" />
        </button>

        {/* Toggle Video Camera */}
        <button
          id="voice-stage-camera-btn"
          type="button"
          onClick={toggleCamera}
          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 transition cursor-pointer active:scale-95 ${
            isCameraOn
              ? 'bg-[#F27D26] text-white shadow-md shadow-[#F27D26]/20'
              : 'bg-[#18191D] border border-[#26282E] text-slate-200 hover:bg-[#202228]'
          }`}
          title={isCameraOn ? 'Desligar câmera' : 'Ligar câmera'}
        >
          {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>

        {/* Toggle Screen Sharing */}
        <button
          id="voice-stage-screenshare-btn"
          type="button"
          onClick={toggleScreenShare}
          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 transition cursor-pointer active:scale-95 ${
            isScreenSharing
              ? 'bg-[#F27D26] text-white shadow-md shadow-[#F27D26]/20 animate-pulse'
              : 'bg-[#18191D] border border-[#26282E] text-slate-200 hover:bg-[#202228]'
          }`}
          title={isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
        >
          <Monitor className="w-4 h-4" />
          <span className="text-xs hidden md:inline">
            {isScreenSharing ? 'Transmitindo' : 'Compartilhar Tela'}
          </span>
        </button>

        <div className="w-px h-5 bg-[#26282E] mx-1" />

        {/* Leave Voice Room Button */}
        <button
          id="voice-stage-leave-btn"
          type="button"
          onClick={leaveVoice}
          className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-rose-600/20 transition cursor-pointer active:scale-95 font-medium"
          title="Desconectar da chamada"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">Desconectar</span>
        </button>
      </div>
    </div>
  );
};
