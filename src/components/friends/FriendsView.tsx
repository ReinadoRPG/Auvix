import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  MessageSquare,
  UserPlus,
  Clock,
  Check,
  X,
  Phone,
  Video,
  Send,
  Paperclip,
  Smile,
  Search,
  MoreVertical,
  UserMinus,
  Sparkles,
  Circle,
  Mic,
  MicOff,
  Headphones,
  Settings,
  PhoneOff,
  Volume2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFriends } from '../../context/FriendsContext';
import { useVoice } from '../../context/VoiceContext';
import { uploadApi } from '../../services/api';
import { Friend, DMChannel } from '../../types';
import { NotificationCenter } from '../notifications/NotificationCenter';

interface FriendsViewProps {
  onOpenUserSettings?: () => void;
  onNavigateToChannel?: (serverId: string, channelId: string, messageId?: string) => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({ onOpenUserSettings, onNavigateToChannel }) => {
  const { user } = useAuth();
  const {
    activeVoiceChannel,
    activeVoiceServer,
    leaveVoice,
    isMuted,
    isDeafened,
    toggleMute,
    toggleDeafen,
  } = useVoice();
  const {
    friends,
    pendingReceived,
    pendingSent,
    dmChannels,
    activeDM,
    dmMessages,
    loadingDMs,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    selectDM,
    openDM,
    sendDMMessage,
    openUserProfile,
  } = useFriends();

  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending' | 'add'>('online');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [addUsernameInput, setAddUsernameInput] = useState('');
  const [addFeedback, setAddFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // DM chat input
  const [dmInput, setDmInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [dmAttachments, setDmAttachments] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsernameInput.trim()) return;

    setIsSubmittingAdd(true);
    setAddFeedback(null);
    try {
      const cleanUsername = addUsernameInput.trim().replace(/^@/, '');
      const msg = await sendFriendRequest(cleanUsername);
      setAddFeedback({ type: 'success', message: msg || 'Solicitação de amizade enviada com sucesso!' });
      setAddUsernameInput('');
    } catch (err: any) {
      setAddFeedback({ type: 'error', message: err.message || 'Falha ao enviar solicitação.' });
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleSendDM = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!dmInput.trim() && dmAttachments.length === 0) || !activeDM) return;

    const content = dmInput.trim();
    const attachments = [...dmAttachments];
    setDmInput('');
    setDmAttachments([]);

    await sendDMMessage(content, attachments.length > 0 ? attachments : undefined);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await uploadApi.uploadFile(file);
      setDmAttachments((prev) => [...prev, res.url]);
    } catch (err: any) {
      alert(err.message || 'Erro ao fazer upload de anexo');
    } finally {
      setIsUploading(false);
    }
  };

  const onlineFriends = friends.filter((f) => f.user.status === 'ONLINE' || f.user.status === 'IDLE' || f.user.status === 'DND');
  const filteredFriends = (activeTab === 'online' ? onlineFriends : friends).filter(
    (f) =>
      f.user.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
      (f.user.displayName && f.user.displayName.toLowerCase().includes(friendSearchQuery.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-emerald-500';
      case 'IDLE':
        return 'bg-amber-500';
      case 'DND':
        return 'bg-rose-500';
      default:
        return 'bg-zinc-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'Disponível';
      case 'IDLE':
        return 'Ausente';
      case 'DND':
        return 'Ocupado';
      default:
        return 'Offline';
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0c0e12]">
      {/* DM & Social Sidebar */}
      <div className="w-60 bg-[#0a0c10] border-r border-[#1a1e27] flex flex-col shrink-0">
        {/* Friends button */}
        <div className="p-3 border-b border-[#181c26]">
          <button
            id="btn-nav-friends-tab"
            onClick={() => selectDM(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              !activeDM
                ? 'bg-[#1e2330] text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141720]'
            }`}
          >
            <Users className="w-4 h-4 text-[#F27D26]" />
            <span>Amigos</span>
            {pendingReceived.length > 0 && (
              <span className="ml-auto bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {pendingReceived.length}
              </span>
            )}
          </button>
        </div>

        {/* Direct Messages List */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="px-2 py-1.5 flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            <span>Mensagens Diretas</span>
          </div>

          <div className="space-y-0.5">
            {dmChannels.length === 0 ? (
              <div className="px-3 py-6 text-center text-zinc-600 text-xs">
                Nenhuma conversa recente
              </div>
            ) : (
              dmChannels.map((dm) => {
                const isActive = activeDM?.id === dm.id;
                return (
                  <button
                    key={dm.id}
                    id={`btn-dm-${dm.id}`}
                    onClick={() => selectDM(dm)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group ${
                      isActive
                        ? 'bg-[#1a1f2c] text-white'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#12151d]'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={dm.recipient.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${dm.recipient.username}`}
                        alt={dm.recipient.displayName || dm.recipient.username}
                        className="w-8 h-8 rounded-full bg-[#181b22] object-cover"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0a0c10] ${getStatusColor(
                          dm.recipient.status
                        )}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200 truncate">
                          {dm.recipient.displayName || dm.recipient.username}
                        </span>
                        {dm.unreadCount && dm.unreadCount > 0 ? (
                          <span className="bg-[#F27D26] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                            {dm.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-zinc-500 truncate block">
                        @{dm.recipient.username}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Active Voice Channel Bar (if connected) */}
        {activeVoiceChannel && (
          <div className="bg-[#10141d] border-t border-[#1e2433] px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="truncate">
                <div className="text-[11px] font-semibold text-emerald-400 truncate flex items-center gap-1">
                  <Volume2 className="w-3 h-3 shrink-0" />
                  <span>Voz Conectada</span>
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {activeVoiceServer?.name} / {activeVoiceChannel.name}
                </div>
              </div>
            </div>
            <button
              id="disconnect-voice-from-friends-btn"
              type="button"
              onClick={leaveVoice}
              className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg transition shrink-0"
              title="Desconectar da voz"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* User Presence & Controls Footer */}
        {user && (
          <div className="h-[54px] bg-[#0b0d11] border-t border-[#181c26] px-2.5 flex items-center justify-between shrink-0">
            <div
              className="flex items-center gap-2 overflow-hidden cursor-pointer hover:bg-[#151821] p-1 rounded-lg transition flex-1 mr-1"
              onClick={() => openUserProfile(user)}
              title="Ver meu perfil"
            >
              <div className="relative shrink-0">
                <img
                  src={
                    user.avatarUrl ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`
                  }
                  alt={user.displayName || user.username}
                  className="w-8 h-8 rounded-lg object-cover bg-[#18191D] border border-[#26282E]"
                  referrerPolicy="no-referrer"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-1 ring-[#0E0F12] ${getStatusColor(
                    user.status
                  )}`}
                />
              </div>
              <div className="truncate flex flex-col">
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {user.displayName || user.username}
                </span>
                <span className="text-[10px] font-mono text-zinc-500 truncate">
                  @{user.username}
                </span>
              </div>
            </div>

            {/* Audio & Settings Buttons */}
            <div className="flex items-center gap-0.5">
              <button
                id="friends-toggle-mic-btn"
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
                id="friends-toggle-deafen-btn"
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

              {onOpenUserSettings && (
                <button
                  id="friends-open-user-settings-btn"
                  type="button"
                  onClick={onOpenUserSettings}
                  className="p-1.5 text-slate-400 hover:bg-[#1E2026] hover:text-slate-200 rounded-lg transition cursor-pointer"
                  title="Configurações do Usuário"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area: Friends Management OR Active DM */}
      {!activeDM ? (
        /* FRIENDS TAB VIEW */
        <div className="flex-1 flex flex-col bg-[#0e1015] overflow-hidden">
          {/* Top Bar Navigation */}
          <div className="h-12 border-b border-[#1c212c] px-6 flex items-center justify-between shrink-0 bg-[#0e1015]">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Users className="w-4 h-4 text-zinc-400" />
                <span>Amigos</span>
              </div>

              <div className="h-4 w-px bg-zinc-800" />

              <div className="flex items-center gap-2">
                <button
                  id="tab-friends-online"
                  onClick={() => setActiveTab('online')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeTab === 'online'
                      ? 'bg-[#202532] text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141822]'
                  }`}
                >
                  Disponíveis ({onlineFriends.length})
                </button>

                <button
                  id="tab-friends-all"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeTab === 'all'
                      ? 'bg-[#202532] text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141822]'
                  }`}
                >
                  Todos ({friends.length})
                </button>

                <button
                  id="tab-friends-pending"
                  onClick={() => setActiveTab('pending')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeTab === 'pending'
                      ? 'bg-[#202532] text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141822]'
                  }`}
                >
                  <span>Pendentes</span>
                  {pendingReceived.length > 0 && (
                    <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {pendingReceived.length}
                    </span>
                  )}
                </button>

                <button
                  id="tab-friends-add"
                  onClick={() => setActiveTab('add')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    activeTab === 'add'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white'
                  }`}
                >
                  Adicionar Amigo
                </button>
              </div>
            </div>

            {/* Notification Center */}
            <div className="flex items-center gap-2">
              <NotificationCenter onNavigateToChannel={onNavigateToChannel} />
            </div>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* ADD FRIEND TAB */}
            {activeTab === 'add' && (
              <div className="max-w-xl space-y-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200 mb-1">
                    Adicionar Amigo
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Você pode adicionar amigos usando o nome de usuário exclusivo (@username).
                  </p>
                </div>

                <form onSubmit={handleSendRequest} className="space-y-3">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      id="input-add-friend-username"
                      value={addUsernameInput}
                      onChange={(e) => setAddUsernameInput(e.target.value)}
                      placeholder="Digite um @username (ex: victinnx)"
                      className="w-full px-4 py-3 rounded-xl bg-[#08090d] border border-[#222734] text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 pr-36"
                    />
                    <button
                      type="submit"
                      id="btn-send-friend-request"
                      disabled={isSubmittingAdd || !addUsernameInput.trim()}
                      className="absolute right-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                    >
                      {isSubmittingAdd ? 'Enviando...' : 'Enviar Pedido'}
                    </button>
                  </div>

                  {addFeedback && (
                    <div
                      className={`p-3 rounded-lg text-xs border ${
                        addFeedback.type === 'success'
                          ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-800/40 text-rose-300'
                      }`}
                    >
                      {addFeedback.message}
                    </div>
                  )}
                </form>

                <div className="pt-8 border-t border-[#1e232d] flex flex-col items-center justify-center text-center text-zinc-500 py-10">
                  <Sparkles className="w-10 h-10 text-zinc-600 mb-3" />
                  <p className="text-xs max-w-sm">
                    No Auvix, todas as contas são reais e verificadas. Compartilhe seu @username para começar a conversar!
                  </p>
                </div>
              </div>
            )}

            {/* PENDING REQUESTS TAB */}
            {activeTab === 'pending' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                    Solicitações Recebidas — {pendingReceived.length}
                  </h4>
                  {pendingReceived.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-600 bg-[#0a0c10] border border-[#1a1e27] rounded-xl">
                      Nenhuma solicitação de amizade pendente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingReceived.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#12151d] border border-[#202532]"
                        >
                          <div
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => openUserProfile(req.sender)}
                          >
                            <img
                              src={req.sender.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.sender.username}`}
                              alt={req.sender.displayName || req.sender.username}
                              className="w-10 h-10 rounded-full bg-[#181b24] object-cover"
                            />
                            <div>
                              <span className="text-xs font-bold text-zinc-200 block">
                                {req.sender.displayName || req.sender.username}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-400">
                                @{req.sender.username}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              id={`btn-accept-req-${req.id}`}
                              onClick={() => acceptFriendRequest(req.id)}
                              className="p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors"
                              title="Aceitar"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              id={`btn-reject-req-${req.id}`}
                              onClick={() => rejectFriendRequest(req.id)}
                              className="p-2 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white transition-colors"
                              title="Recusar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                    Solicitações Enviadas — {pendingSent.length}
                  </h4>
                  {pendingSent.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-600 bg-[#0a0c10] border border-[#1a1e27] rounded-xl">
                      Nenhuma solicitação enviada aguardando resposta.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingSent.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#12151d] border border-[#202532]"
                        >
                          <div
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => openUserProfile(req.receiver)}
                          >
                            <img
                              src={req.receiver.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.receiver.username}`}
                              alt={req.receiver.displayName || req.receiver.username}
                              className="w-10 h-10 rounded-full bg-[#181b24] object-cover"
                            />
                            <div>
                              <span className="text-xs font-bold text-zinc-200 block">
                                {req.receiver.displayName || req.receiver.username}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-400">
                                @{req.receiver.username}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => rejectFriendRequest(req.id)}
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors text-xs flex items-center gap-1"
                            title="Cancelar Pedido"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancelar</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ONLINE & ALL FRIENDS LIST */}
            {(activeTab === 'online' || activeTab === 'all') && (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 absolute left-3 text-zinc-500" />
                  <input
                    type="text"
                    value={friendSearchQuery}
                    onChange={(e) => setFriendSearchQuery(e.target.value)}
                    placeholder="Buscar amigos por nome ou @username..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0a0c10] border border-[#202532] text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#F27D26]"
                  />
                </div>

                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 pt-2">
                  {activeTab === 'online' ? 'Amigos Disponíveis' : 'Todos os Amigos'} — {filteredFriends.length}
                </div>

                {filteredFriends.length === 0 ? (
                  <div className="text-center py-16 text-zinc-600 text-xs">
                    {friends.length === 0
                      ? 'Você ainda não possui amigos adicionados. Clique em "Adicionar Amigo" para começar!'
                      : 'Nenhum amigo encontrado com esses critérios.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFriends.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#12151d] hover:bg-[#161a24] border border-[#202532] transition-colors group"
                      >
                        <div
                          className="flex items-center gap-3 cursor-pointer min-w-0"
                          onClick={() => openUserProfile(f.user)}
                        >
                          <div className="relative shrink-0">
                            <img
                              src={f.user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${f.user.username}`}
                              alt={f.user.displayName || f.user.username}
                              className="w-10 h-10 rounded-full bg-[#181b24] object-cover"
                            />
                            <span
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#12151d] ${getStatusColor(
                                f.user.status
                              )}`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-200 truncate">
                                {f.user.displayName || f.user.username}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-400">
                                @{f.user.username}
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-400 truncate block">
                              {f.user.customStatus || getStatusLabel(f.user.status)}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            id={`btn-open-dm-${f.user.id}`}
                            onClick={() => openDM(f.user.id)}
                            className="p-2 rounded-lg bg-[#1e2432] hover:bg-[#283144] text-zinc-300 hover:text-white transition-colors"
                            title="Enviar Mensagem Direta"
                          >
                            <MessageSquare className="w-4 h-4 text-cyan-400" />
                          </button>

                          <button
                            id={`btn-view-profile-${f.user.id}`}
                            onClick={() => openUserProfile(f.user)}
                            className="p-2 rounded-lg bg-[#1e2432] hover:bg-[#283144] text-zinc-400 hover:text-zinc-200 transition-colors"
                            title="Ver Perfil"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* DIRECT MESSAGE CHAT VIEW */
        <div className="flex-1 flex flex-col bg-[#0c0e12] overflow-hidden">
          {/* DM Top Bar */}
          <div className="h-12 border-b border-[#1c212c] px-6 flex items-center justify-between shrink-0 bg-[#0e1015]">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => openUserProfile(activeDM.recipient)}
            >
              <div className="relative">
                <img
                  src={activeDM.recipient.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeDM.recipient.username}`}
                  alt={activeDM.recipient.displayName || activeDM.recipient.username}
                  className="w-7 h-7 rounded-full bg-[#181b22] object-cover"
                />
                <span
                  className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-[#0e1015] ${getStatusColor(
                    activeDM.recipient.status
                  )}`}
                />
              </div>

              <div>
                <span className="text-xs font-bold text-zinc-200">
                  {activeDM.recipient.displayName || activeDM.recipient.username}
                </span>
                <span className="text-[11px] font-mono text-zinc-400 ml-1.5">
                  @{activeDM.recipient.username}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openUserProfile(activeDM.recipient)}
                className="px-3 py-1 rounded-lg bg-[#1a1e28] hover:bg-[#242b3a] text-zinc-300 text-xs font-medium transition-colors"
              >
                Ver Perfil
              </button>
            </div>
          </div>

          {/* DM Messages Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Header intro */}
            <div className="pt-8 pb-4 border-b border-[#1a1f2a]">
              <img
                src={activeDM.recipient.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeDM.recipient.username}`}
                alt={activeDM.recipient.displayName || activeDM.recipient.username}
                className="w-16 h-16 rounded-full bg-[#181b22] object-cover mb-3"
              />
              <h2 className="text-lg font-bold text-white">
                {activeDM.recipient.displayName || activeDM.recipient.username}
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                @{activeDM.recipient.username}
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                Este é o início da sua conversa direta com @{activeDM.recipient.username}.
              </p>
            </div>

            {/* Message Stream */}
            {dmMessages.map((msg) => {
              const isMe = msg.authorId === user?.id;
              const author = isMe ? user : activeDM.recipient;

              return (
                <div
                  key={msg.id}
                  className="flex items-start gap-3 group hover:bg-[#12151e]/40 p-2 rounded-lg -mx-2 transition-colors"
                >
                  <img
                    src={author?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${author?.username}`}
                    alt={author?.displayName || author?.username}
                    className="w-9 h-9 rounded-full bg-[#181b24] object-cover shrink-0 cursor-pointer"
                    onClick={() => author && openUserProfile(author)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-xs font-bold text-zinc-200 cursor-pointer hover:underline"
                        onClick={() => author && openUserProfile(author)}
                      >
                        {author?.displayName || author?.username}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.attachments.map((attUrl, i) => (
                          <a
                            key={i}
                            href={attUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block max-w-sm rounded-lg overflow-hidden border border-[#2a3140]"
                          >
                            <img src={attUrl} alt="Anexo" className="max-h-60 object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* DM Input Bar */}
          <div className="p-4 bg-[#0c0e12] border-t border-[#181c25]">
            {dmAttachments.length > 0 && (
              <div className="flex gap-2 mb-2">
                {dmAttachments.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="Upload" className="w-14 h-14 rounded-lg object-cover border border-[#2e3748]" />
                    <button
                      onClick={() => setDmAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-600 rounded-full text-white text-[10px] flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSendDM} className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,video/*,audio/*,.pdf,.zip"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2.5 rounded-lg bg-[#161a24] hover:bg-[#202634] text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Anexar arquivo"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                id="input-dm-message"
                value={dmInput}
                onChange={(e) => setDmInput(e.target.value)}
                placeholder={`Conversar com @${activeDM.recipient.username}...`}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#141720] border border-[#222734] text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#F27D26]"
              />

              <button
                type="submit"
                id="btn-send-dm"
                disabled={!dmInput.trim() && dmAttachments.length === 0}
                className="p-2.5 rounded-lg bg-[#F27D26] hover:bg-[#e06d19] disabled:opacity-40 text-white transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
