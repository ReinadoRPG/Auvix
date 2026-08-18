import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  UserPlus,
  UserCheck,
  UserMinus,
  MessageSquare,
  Shield,
  Clock,
  Copy,
  Check,
  AlertTriangle,
  VolumeX,
  UserX,
  Ban,
} from 'lucide-react';
import { User, Role } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useFriends } from '../../context/FriendsContext';
import { useServer } from '../../context/ServerContext';
import { serverApi } from '../../services/api';

export const UserProfileModal: React.FC = () => {
  const { user: currentUser } = useAuth();
  const {
    activeProfileUser,
    closeUserProfile,
    friends,
    pendingSent,
    pendingReceived,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    openDM,
  } = useFriends();
  const { activeServer, serverMembers, loadServers } = useServer();

  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [showBanConfirm, setShowBanConfirm] = useState(false);

  if (!activeProfileUser) return null;

  const isSelf = currentUser?.id === activeProfileUser.id;
  const isFriend = friends.some((f) => f.user.id === activeProfileUser.id);
  const isPendingSent = pendingSent.some((r) => r.receiverId === activeProfileUser.id);
  const pendingReceivedReq = pendingReceived.find((r) => r.senderId === activeProfileUser.id);

  // Find member in active server if inside a server
  const serverMember = activeServer
    ? serverMembers.find((m) => m.userId === activeProfileUser.id)
    : null;

  // Check operator permissions in active server
  const isOwner = activeServer?.ownerId === currentUser?.id;
  const canKick = isOwner && !isSelf;
  const canBan = isOwner && !isSelf;

  const handleCopyHandle = () => {
    navigator.clipboard.writeText(`@${activeProfileUser.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendFriendRequest = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const msg = await sendFriendRequest(activeProfileUser.username);
      setFeedback(msg);
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao enviar solicitação.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!pendingReceivedReq) return;
    setActionLoading(true);
    try {
      await acceptFriendRequest(pendingReceivedReq.id);
      setFeedback('Solicitação aceita com sucesso!');
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao aceitar.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    setActionLoading(true);
    try {
      await removeFriend(activeProfileUser.id);
      setFeedback('Amigo removido.');
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao remover.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartDM = async () => {
    closeUserProfile();
    await openDM(activeProfileUser.id);
  };

  const handleKick = async () => {
    if (!activeServer) return;
    setActionLoading(true);
    try {
      await serverApi.kickMember(activeServer.id, activeProfileUser.id);
      await loadServers();
      closeUserProfile();
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao expulsar membro.');
      setActionLoading(false);
    }
  };

  const handleBan = async () => {
    if (!activeServer) return;
    setActionLoading(true);
    try {
      await serverApi.banMember(activeServer.id, activeProfileUser.id, banReason);
      await loadServers();
      closeUserProfile();
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao banir membro.');
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-emerald-500 ring-emerald-500/20';
      case 'IDLE':
        return 'bg-amber-500 ring-amber-500/20';
      case 'DND':
        return 'bg-rose-500 ring-rose-500/20';
      default:
        return 'bg-zinc-500 ring-zinc-500/20';
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
        return 'Invisível / Offline';
    }
  };

  return (
    <AnimatePresence>
      <div
        id="user-profile-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
        onClick={closeUserProfile}
      >
        <motion.div
          id="user-profile-modal-card"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-md bg-[#12141a] border border-[#262b36] rounded-xl shadow-2xl overflow-hidden text-zinc-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Profile Header / Banner */}
          <div className="relative h-28 bg-gradient-to-r from-[#1c2230] via-[#2a2438] to-[#1e293b] border-b border-[#262b36]">
            <button
              id="btn-close-profile"
              onClick={closeUserProfile}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 hover:bg-black/70 text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Avatar & Main Info */}
          <div className="px-6 pb-6 relative">
            <div className="flex justify-between items-end -mt-12 mb-4">
              <div className="relative">
                <img
                  src={activeProfileUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeProfileUser.username}`}
                  alt={activeProfileUser.displayName || activeProfileUser.username}
                  className="w-22 h-22 rounded-full border-4 border-[#12141a] bg-[#181b22] object-cover shadow-lg"
                />
                <span
                  className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-[#12141a] ring-2 ${getStatusColor(
                    activeProfileUser.status
                  )}`}
                />
              </div>

              {/* Action Buttons */}
              {!isSelf && (
                <div className="flex items-center gap-2">
                  <button
                    id="btn-profile-dm"
                    onClick={handleStartDM}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#222734] hover:bg-[#2c3345] text-zinc-200 text-sm font-medium border border-[#303848] transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    <span>Mensagem</span>
                  </button>

                  {isFriend ? (
                    <button
                      id="btn-profile-remove-friend"
                      onClick={handleRemoveFriend}
                      disabled={actionLoading}
                      title="Remover Amigo"
                      className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  ) : pendingReceivedReq ? (
                    <button
                      id="btn-profile-accept-friend"
                      onClick={handleAcceptRequest}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Aceitar</span>
                    </button>
                  ) : isPendingSent ? (
                    <span className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-medium border border-zinc-700">
                      Solicitado
                    </span>
                  ) : (
                    <button
                      id="btn-profile-add-friend"
                      onClick={handleSendFriendRequest}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#F27D26] hover:bg-[#e06d19] text-white text-sm font-medium shadow-sm transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Adicionar</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Display Name & Handle */}
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {activeProfileUser.displayName || activeProfileUser.username}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-mono text-zinc-400">
                  @{activeProfileUser.username}
                </span>
                <button
                  id="btn-copy-handle"
                  onClick={handleCopyHandle}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  title="Copiar @username"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Status pill */}
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#1a1e28] text-zinc-300 border border-[#283040]">
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(activeProfileUser.status)}`} />
                  {getStatusLabel(activeProfileUser.status)}
                </span>
                {activeProfileUser.customStatus && (
                  <span className="text-xs text-zinc-400 italic truncate max-w-[240px]">
                    "{activeProfileUser.customStatus}"
                  </span>
                )}
              </div>
            </div>

            {/* Feedback alert */}
            {feedback && (
              <div className="mb-4 p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-200 text-xs">
                {feedback}
              </div>
            )}

            {/* Bio */}
            {activeProfileUser.bio && (
              <div className="mb-4 p-3 rounded-lg bg-[#181b24] border border-[#242a38]">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Sobre mim
                </span>
                <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {activeProfileUser.bio}
                </p>
              </div>
            )}

            {/* Server Roles */}
            {serverMember && serverMember.roles && serverMember.roles.length > 0 && (
              <div className="mb-4">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Cargos no Servidor
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {serverMember.roles.map((role) => (
                    <span
                      key={role.id}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#1a1e28] border border-[#2d3648]"
                      style={{ color: role.color || '#94a3b8' }}
                    >
                      <Shield className="w-3 h-3" />
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Member Since */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 pt-2 border-t border-[#222734]">
              <Clock className="w-3.5 h-3.5" />
              <span>
                No Auvix desde {new Date(activeProfileUser.createdAt || Date.now()).toLocaleDateString('pt-BR')}
              </span>
            </div>

            {/* Moderation Controls for Admins/Owners */}
            {activeServer && (canKick || canBan) && (
              <div className="mt-4 pt-3 border-t border-[#222734]">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block mb-2">
                  Ações de Moderação
                </span>

                {!showBanConfirm ? (
                  <div className="flex gap-2">
                    {canKick && (
                      <button
                        id="btn-kick-member"
                        onClick={handleKick}
                        disabled={actionLoading}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/30 hover:bg-amber-900/50 text-amber-300 text-xs font-medium border border-amber-800/40 transition-colors"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Expulsar</span>
                      </button>
                    )}
                    {canBan && (
                      <button
                        id="btn-ban-member-prompt"
                        onClick={() => setShowBanConfirm(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-xs font-medium border border-rose-800/40 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Banir</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/50 space-y-2">
                    <p className="text-xs text-rose-200 font-medium">
                      Confirmar banimento de @{activeProfileUser.username}?
                    </p>
                    <input
                      type="text"
                      placeholder="Motivo do banimento (opcional)"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[#0d0f14] border border-rose-800/50 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setShowBanConfirm(false)}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        id="btn-confirm-ban"
                        onClick={handleBan}
                        disabled={actionLoading}
                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
                      >
                        Confirmar Banimento
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
