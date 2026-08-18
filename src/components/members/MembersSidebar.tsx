import React from 'react';
import { useServer } from '../../context/ServerContext';
import { useVoice } from '../../context/VoiceContext';
import { useFriends } from '../../context/FriendsContext';
import { Crown, Volume2, Shield } from 'lucide-react';
import { ServerMember } from '../../types';

export const MembersSidebar: React.FC = () => {
  const { activeServer, serverMembers } = useServer();
  const { participants } = useVoice();
  const { openUserProfile } = useFriends();

  if (!activeServer) return null;

  const onlineMembers = serverMembers.filter(
    (m) => m.user.status === 'ONLINE' || m.user.status === 'IDLE' || m.user.status === 'DND' || m.user.status === 'DO_NOT_DISTURB'
  );
  const offlineMembers = serverMembers.filter(
    (m) => !m.user.status || m.user.status === 'OFFLINE' || m.user.status === 'INVISIBLE'
  );

  const getStatusDot = (status?: string) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-emerald-500 ring-emerald-500/20';
      case 'IDLE':
        return 'bg-amber-500 ring-amber-500/20';
      case 'DO_NOT_DISTURB':
      case 'DND':
        return 'bg-rose-500 ring-rose-500/20';
      default:
        return 'bg-slate-500 ring-slate-500/20';
    }
  };

  const renderMemberItem = (member: ServerMember) => {
    const isOwner = member.userId === activeServer.ownerId;
    const isVoiceActive = participants.some((p) => p.userId === member.userId);
    const topRole = member.roles && member.roles.length > 0 ? member.roles[0] : null;

    return (
      <div
        key={member.id}
        id={`member-item-${member.userId}`}
        onClick={() => openUserProfile(member.user)}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#18191D] border border-transparent hover:border-[#1E2024] transition cursor-pointer select-none group"
      >
        <div className="relative shrink-0">
          <img
            src={
              member.user.avatarUrl ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${member.user.username}`
            }
            alt={member.user.displayName || member.user.username}
            className="w-7 h-7 rounded-lg object-cover bg-[#18191D] border border-[#26282E]"
            referrerPolicy="no-referrer"
          />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-[#121316] ${getStatusDot(
              member.user.status
            )}`}
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5 truncate">
            <span
              className="text-xs font-semibold truncate"
              style={{ color: topRole?.color || (isOwner ? '#F27D26' : '#e2e8f0') }}
            >
              {member.user.displayName || member.nickname || member.user.username}
            </span>

            {isOwner && (
              <Crown className="w-3 h-3 text-[#F27D26] shrink-0" title="Proprietário do Servidor" />
            )}

            {isVoiceActive && (
              <Volume2 className="w-3 h-3 text-[#FF9345] shrink-0 animate-pulse" title="Conectado na chamada" />
            )}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-slate-500 truncate">
              @{member.user.username}
            </span>
          </div>

          {member.user.customStatus && (
            <span className="text-[9px] text-slate-400 italic truncate">
              {member.user.customStatus}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside
      aria-label="Membros do Servidor"
      className="w-56 h-full bg-[#121316] border-l border-[#1E2024] p-3 flex flex-col overflow-y-auto no-scrollbar shrink-0 z-10"
    >
      {/* ONLINE MEMBERS */}
      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-1.5 flex items-center justify-between">
          <span>Disponíveis</span>
          <span className="text-[#F27D26] bg-[#1E2026] border border-[#26282E] px-1.5 rounded text-[9px]">
            {onlineMembers.length}
          </span>
        </div>
        <div className="space-y-0.5">{onlineMembers.map(renderMemberItem)}</div>
      </div>

      {/* OFFLINE MEMBERS */}
      {offlineMembers.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2 mb-1.5 flex items-center justify-between">
            <span>Offline</span>
            <span className="bg-[#1E2026] border border-[#26282E] px-1.5 rounded text-[9px] text-slate-500">
              {offlineMembers.length}
            </span>
          </div>
          <div className="space-y-0.5 opacity-60">{offlineMembers.map(renderMemberItem)}</div>
        </div>
      )}
    </aside>
  );
};
