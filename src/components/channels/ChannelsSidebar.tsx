import React, { useState } from 'react';
import { useServer } from '../../context/ServerContext';
import { useVoice } from '../../context/VoiceContext';
import { useAuth } from '../../context/AuthContext';
import { NotificationCenter } from '../notifications/NotificationCenter';
import {
  Hash,
  Volume2,
  Plus,
  ChevronDown,
  Settings,
  UserPlus,
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Video,
  Monitor,
  Trash2,
  SlidersHorizontal,
  Circle,
} from 'lucide-react';
import { Channel, PresenceStatus } from '../../types';

interface ChannelsSidebarProps {
  onOpenCreateChannel: (type: 'TEXT' | 'VOICE') => void;
  onOpenInvite: () => void;
  onOpenUserSettings: () => void;
  onOpenServerSettings: () => void;
  onNavigateToChannel?: (serverId: string, channelId: string, messageId?: string) => void;
}

export const ChannelsSidebar: React.FC<ChannelsSidebarProps> = ({
  onOpenCreateChannel,
  onOpenInvite,
  onOpenUserSettings,
  onOpenServerSettings,
  onNavigateToChannel,
}) => {
  const { activeServer, activeChannel, selectChannel, deleteChannel, deleteServer } = useServer();
  const {
    activeVoiceChannel,
    activeVoiceServer,
    participants,
    globalVoiceChannels,
    joinVoice,
    leaveVoice,
    isMuted,
    isDeafened,
    toggleMute,
    toggleDeafen,
  } = useVoice();
  const { user, setPresence } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  if (!activeServer) {
    return (
      <div className="w-60 h-full bg-[#121316] flex flex-col justify-center items-center p-4 text-center text-slate-500 border-r border-[#1E2024]">
        <p className="text-xs">Selecione um servidor</p>
      </div>
    );
  }

  const textChannels = activeServer.channels.filter((c) => c.type === 'TEXT');
  const voiceChannels = activeServer.channels.filter((c) => c.type === 'VOICE');
  const isOwner = user && activeServer.ownerId === user.id;

  const handleVoiceChannelClick = (channel: Channel) => {
    if (activeVoiceChannel?.id === channel.id) {
      selectChannel(channel);
    } else {
      joinVoice(channel, activeServer);
      selectChannel(channel);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-emerald-500 ring-emerald-500/20';
      case 'IDLE':
        return 'bg-amber-500 ring-amber-500/20';
      case 'DO_NOT_DISTURB':
      case 'DND':
        return 'bg-rose-500 ring-rose-500/20';
      case 'INVISIBLE':
      case 'OFFLINE':
      default:
        return 'bg-slate-500 ring-slate-500/20';
    }
  };

  return (
    <aside
      aria-label="Canais do Servidor"
      className="w-60 h-full bg-[#121316] flex flex-col select-none shrink-0 border-r border-[#1E2024] z-20"
    >
      {/* Server Header & Notifications */}
      <div className="h-12 px-3 border-b border-[#1E2024] flex items-center justify-between relative bg-[#121316]">
        <div className="relative flex-1 min-w-0 pr-1">
          <button
            id="server-header-dropdown-btn"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-full h-10 px-2 flex items-center justify-between font-bold text-xs text-slate-100 hover:bg-[#18191D] rounded-lg transition cursor-pointer"
          >
            <span className="truncate flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#F27D26] rounded-xs" />
              {activeServer.name}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                menuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-11 left-0 right-0 bg-[#18191D] border border-[#26282E] rounded-xl shadow-2xl p-1.5 z-50 space-y-1">
                <button
                  id="menu-invite-btn"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenInvite();
                  }}
                  className="w-full px-3 py-2 text-xs font-medium text-[#F27D26] hover:bg-[#F27D26]/10 rounded-lg flex items-center justify-between transition cursor-pointer"
                >
                  <span>Convidar Pessoas</span>
                  <UserPlus className="w-4 h-4" />
                </button>

                <button
                  id="menu-server-settings-btn"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenServerSettings();
                  }}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-200 hover:bg-[#26282E]/50 rounded-lg flex items-center justify-between transition cursor-pointer"
                >
                  <span>Configurações do Servidor</span>
                  <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  id="menu-create-text-chn-btn"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenCreateChannel('TEXT');
                  }}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-300 hover:bg-[#26282E]/50 rounded-lg flex items-center justify-between transition cursor-pointer"
                >
                  <span>Criar Canal de Texto</span>
                  <Plus className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  id="menu-create-voice-chn-btn"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenCreateChannel('VOICE');
                  }}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-300 hover:bg-[#26282E]/50 rounded-lg flex items-center justify-between transition cursor-pointer"
                >
                  <span>Criar Canal de Voz</span>
                  <Volume2 className="w-4 h-4 text-slate-400" />
                </button>

                {isOwner && (
                  <button
                    id="menu-delete-server-btn"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      if (confirm(`Tem certeza que deseja excluir o servidor "${activeServer.name}"?`)) {
                        deleteServer(activeServer.id);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-600/15 rounded-lg flex items-center justify-between transition cursor-pointer"
                  >
                    <span>Excluir Servidor</span>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Global Notifications Bell */}
        <NotificationCenter onNavigateToChannel={onNavigateToChannel} />
      </div>

      {/* Channels Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 no-scrollbar">
        {/* TEXT CHANNELS CATEGORY */}
        <div>
          <div className="flex items-center justify-between px-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">
            <span className="flex items-center gap-1.5">
              <span className="text-[#F27D26]">#</span> Canais de Texto
            </span>
            <button
              id="add-text-channel-btn"
              type="button"
              onClick={() => onOpenCreateChannel('TEXT')}
              className="text-slate-400 hover:text-[#F27D26] p-0.5 rounded cursor-pointer transition"
              title="Criar Canal de Texto"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {textChannels.map((channel) => {
              const isActive = activeChannel?.id === channel.id;

              return (
                <div
                  key={channel.id}
                  className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-[#1E2026] text-white border border-[#26282E] shadow-sm font-semibold'
                      : 'text-slate-400 hover:bg-[#18191D] hover:text-slate-200 border border-transparent'
                  }`}
                  onClick={() => selectChannel(channel)}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Hash
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-[#F27D26]' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{channel.name}</span>
                  </div>

                  {isOwner && textChannels.length > 1 && (
                    <button
                      id={`delete-channel-${channel.id}-btn`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Excluir o canal #${channel.name}?`)) {
                          deleteChannel(channel.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-0.5 rounded transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* VOICE CHANNELS CATEGORY */}
        <div>
          <div className="flex items-center justify-between px-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">
            <span className="flex items-center gap-1.5">
              <span className="text-[#F27D26]">•</span> Canais de Voz e Vídeo
            </span>
            <button
              id="add-voice-channel-btn"
              type="button"
              onClick={() => onOpenCreateChannel('VOICE')}
              className="text-slate-400 hover:text-[#F27D26] p-0.5 rounded cursor-pointer transition"
              title="Criar Canal de Voz"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            {voiceChannels.map((channel) => {
              const isVoiceConnectedHere = activeVoiceChannel?.id === channel.id;
              const channelParticipants = isVoiceConnectedHere
                ? participants
                : globalVoiceChannels[channel.id] || [];

              return (
                <div key={channel.id} className="space-y-0.5">
                  <div
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      isVoiceConnectedHere
                        ? 'bg-[#F27D26]/15 text-[#FF9345] border border-[#F27D26]/40 font-semibold'
                        : 'text-slate-400 hover:bg-[#18191D] hover:text-slate-200 border border-transparent'
                    }`}
                    onClick={() => handleVoiceChannelClick(channel)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Volume2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isVoiceConnectedHere ? 'text-[#F27D26] animate-pulse' : 'text-slate-500'
                        }`}
                      />
                      <span className="truncate">{channel.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {channelParticipants.length > 0 && (
                        <span className="text-[10px] bg-[#1E2026] border border-[#26282E] text-[#F27D26] px-1.5 py-0.2 rounded font-semibold">
                          {channelParticipants.length}
                        </span>
                      )}

                      {isOwner && voiceChannels.length > 1 && (
                        <button
                          id={`delete-voice-channel-${channel.id}-btn`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Excluir o canal de voz ${channel.name}?`)) {
                              deleteChannel(channel.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-0.5 rounded transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Connected Voice Participants inside this channel */}
                  {channelParticipants.length > 0 && (
                    <div className="pl-5 pr-2 py-0.5 space-y-1">
                      {channelParticipants.map((p) => (
                        <div
                          key={p.userId}
                          className="flex items-center justify-between py-0.5 text-xs text-slate-300"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className="relative shrink-0">
                              <img
                                src={
                                  p.user.avatarUrl ||
                                  `https://api.dicebear.com/7.x/bottts/svg?seed=${p.user.username}`
                                }
                                alt={p.user.displayName || p.user.username}
                                className={`w-4 h-4 rounded object-cover transition-all ${
                                  p.isSpeaking ? 'ring-1 ring-[#F27D26] scale-105' : ''
                                }`}
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <span
                              className={`truncate text-xs ${
                                p.isSpeaking ? 'text-[#F27D26] font-semibold' : 'text-slate-400'
                              }`}
                            >
                              {p.user.displayName || p.user.username}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 text-slate-500">
                            {p.isScreenSharing && (
                              <span
                                className="bg-[#F27D26]/20 text-[#F27D26] p-0.5 rounded text-[10px]"
                                title="Transmitindo Tela"
                              >
                                <Monitor className="w-2.5 h-2.5" />
                              </span>
                            )}
                            {p.isCameraOn && (
                              <span
                                className="bg-emerald-500/20 text-emerald-400 p-0.5 rounded text-[10px]"
                                title="Câmera Ligada"
                              >
                                <Video className="w-2.5 h-2.5" />
                              </span>
                            )}
                            {p.isMuted && (
                              <span className="text-rose-400" title="Mutado">
                                <MicOff className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ACTIVE VOICE SESSION FLOATING STRIP */}
      {activeVoiceChannel && (
        <div className="bg-[#101114] border-t border-[#F27D26]/40 px-3 py-2 flex items-center justify-between">
          <div
            className="flex flex-col cursor-pointer"
            onClick={() => selectChannel(activeVoiceChannel)}
          >
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Voz Conectada</span>
            </div>
            <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
              {activeVoiceChannel.name} • {activeVoiceServer?.name}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              id="disconnect-voice-strip-btn"
              type="button"
              onClick={leaveVoice}
              className="p-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg transition cursor-pointer"
              title="Desconectar da chamada"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* USER PROFILE & MEDIA CONTROLS FOOTER */}
      {user && (
        <div className="h-14 bg-[#0E0F12] border-t border-[#1E2024] px-3 flex items-center justify-between relative">
          {/* User info & quick presence toggle */}
          <div className="flex items-center gap-2 truncate">
            <div
              className="relative shrink-0 cursor-pointer group"
              onClick={() => setStatusMenuOpen(!statusMenuOpen)}
              title="Alterar status de presença"
            >
              <img
                src={
                  user.avatarUrl ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`
                }
                alt={user.displayName || user.username}
                className="w-8 h-8 rounded-lg object-cover bg-[#18191D] border border-[#26282E] group-hover:ring-1 group-hover:ring-[#F27D26]"
                referrerPolicy="no-referrer"
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-1 ring-[#0E0F12] ${getStatusColor(
                  user.status
                )}`}
              />
            </div>

            {/* Quick Status Dropdown */}
            {statusMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setStatusMenuOpen(false)} />
                <div className="absolute bottom-16 left-2 w-48 bg-[#18191D] border border-[#26282E] rounded-xl shadow-2xl p-1.5 z-50 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Definir Status
                  </div>
                  {[
                    { val: 'ONLINE', label: 'Disponível', color: 'bg-emerald-500' },
                    { val: 'IDLE', label: 'Ausente', color: 'bg-amber-500' },
                    { val: 'DO_NOT_DISTURB', label: 'Não Perturbar', color: 'bg-rose-500' },
                    { val: 'INVISIBLE', label: 'Invisível', color: 'bg-slate-500' },
                  ].map((st) => (
                    <button
                      key={st.val}
                      type="button"
                      onClick={() => {
                        setPresence(st.val as PresenceStatus);
                        setStatusMenuOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition cursor-pointer ${
                        user.status === st.val
                          ? 'bg-[#F27D26]/20 text-[#FF9345]'
                          : 'text-slate-300 hover:bg-[#26282E]'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${st.color}`} />
                      <span>{st.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div
              className="truncate flex flex-col cursor-pointer hover:opacity-80 transition"
              onClick={onOpenUserSettings}
            >
              <span className="text-xs font-semibold text-slate-200 truncate">
                {user.displayName || user.username}
              </span>
              <span className="text-[10px] font-mono text-zinc-500 truncate">
                @{user.username}
              </span>
            </div>
          </div>

          {/* Controls: Mic, Deafen, Settings */}
          <div className="flex items-center gap-0.5">
            <button
              id="toggle-mic-btn"
              type="button"
              onClick={toggleMute}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isMuted
                  ? 'text-rose-400 hover:bg-rose-500/20 bg-rose-500/10'
                  : 'text-slate-400 hover:bg-[#1E2026] hover:text-slate-200'
              }`}
              title={isMuted ? 'Ativar microfone' : 'Silenciar microfone'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              id="toggle-deafen-btn"
              type="button"
              onClick={toggleDeafen}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isDeafened
                  ? 'text-rose-400 hover:bg-rose-500/20 bg-rose-500/10'
                  : 'text-slate-400 hover:bg-[#1E2026] hover:text-slate-200'
              }`}
              title={isDeafened ? 'Desativar áudio' : 'Ensurdecer'}
            >
              <Headphones className="w-4 h-4" />
            </button>

            <button
              id="open-user-settings-btn"
              type="button"
              onClick={onOpenUserSettings}
              className="p-1.5 text-slate-400 hover:bg-[#1E2026] hover:text-slate-200 rounded-lg transition cursor-pointer"
              title="Configurações do Usuário"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
