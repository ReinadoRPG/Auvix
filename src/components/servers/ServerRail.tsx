import React from 'react';
import { useServer } from '../../context/ServerContext';
import { useVoice } from '../../context/VoiceContext';
import { useFriends } from '../../context/FriendsContext';
import { Radio, Plus, Compass, Volume2, Users } from 'lucide-react';

interface ServerRailProps {
  onOpenCreateServer: () => void;
  onOpenJoinInvite: () => void;
  isFriendsViewActive: boolean;
  onSelectFriendsView: () => void;
  onSelectServer?: () => void;
}

export const ServerRail: React.FC<ServerRailProps> = ({
  onOpenCreateServer,
  onOpenJoinInvite,
  isFriendsViewActive,
  onSelectFriendsView,
  onSelectServer,
}) => {
  const { servers, activeServer, selectServer } = useServer();
  const { activeVoiceServer } = useVoice();
  const { pendingReceived } = useFriends();

  return (
    <nav
      aria-label="Navegação de Servidores"
      className="w-[72px] h-full bg-[#0D0E11] flex flex-col items-center py-3 select-none z-30 shrink-0 border-r border-[#26282E]"
    >
      {/* Auvix Home / Friends Hub */}
      <div className="relative group flex items-center justify-center w-full mb-2">
        {/* Active Pill */}
        <div
          className={`absolute left-0 w-1 bg-[#F27D26] rounded-r transition-all duration-200 ${
            isFriendsViewActive
              ? 'h-8 opacity-100'
              : 'h-2 opacity-0 group-hover:opacity-60 group-hover:h-4'
          }`}
        />

        <button
          id="rail-home-btn"
          type="button"
          onClick={onSelectFriendsView}
          className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 group-hover:scale-105 active:scale-95 cursor-pointer border ${
            isFriendsViewActive
              ? 'bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20 border-[#FF9345]/40'
              : 'bg-[#141519] border-[#26282E] text-slate-300 hover:border-slate-600 hover:text-white'
          }`}
        >
          <Radio className="w-5 h-5" />

          {/* Pending requests badge */}
          {pendingReceived.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-[#0D0E11]">
              {pendingReceived.length}
            </span>
          )}
        </button>

        {/* Tooltip */}
        <div className="absolute left-[80px] bg-[#18191D] text-slate-100 text-xs px-3 py-1.5 rounded-md shadow-xl border border-[#26282E] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
          Início / Amigos
        </div>
      </div>

      <div className="w-8 h-px bg-[#26282E] my-1.5" />

      {/* Server List */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden no-scrollbar flex flex-col items-center space-y-2 py-1">
        {servers.map((server) => {
          const isActive = !isFriendsViewActive && activeServer?.id === server.id;
          const isVoiceActiveHere = activeVoiceServer?.id === server.id;

          return (
            <div key={server.id} className="relative group flex items-center justify-center w-full">
              {/* Active Indicator Pill */}
              <div
                className={`absolute left-0 w-1 bg-[#F27D26] rounded-r transition-all duration-200 ${
                  isActive ? 'h-8 opacity-100' : 'h-2 opacity-0 group-hover:opacity-60 group-hover:h-4'
                }`}
              />

              <button
                id={`rail-server-${server.id}-btn`}
                type="button"
                onClick={() => {
                  selectServer(server);
                  onSelectServer?.();
                }}
                className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 overflow-hidden group-hover:scale-105 active:scale-95 cursor-pointer border ${
                  isActive
                    ? 'bg-[#1E2026] text-white border-[#F27D26] shadow-md shadow-[#F27D26]/10 ring-1 ring-[#F27D26]/30'
                    : 'bg-[#141519] border-[#26282E] text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                {server.iconUrl ? (
                  <img
                    src={server.iconUrl}
                    alt={server.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="font-bold text-xs tracking-wider uppercase text-slate-200">
                    {server.name.substring(0, 2)}
                  </span>
                )}

                {/* Voice Call Active Indicator badge */}
                {isVoiceActiveHere && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-sm flex items-center justify-center text-white ring-1 ring-[#0D0E11] animate-pulse">
                    <Volume2 className="w-2.5 h-2.5" />
                  </div>
                )}
              </button>

              {/* Tooltip */}
              <div className="absolute left-[80px] bg-[#18191D] text-slate-100 text-xs px-3 py-1.5 rounded-md shadow-xl border border-[#26282E] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap flex items-center gap-2">
                <span>{server.name}</span>
                {isVoiceActiveHere && (
                  <span className="text-[10px] text-emerald-400 font-semibold">[Chamada Ativa]</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Create Server Action Button */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            id="rail-create-server-btn"
            type="button"
            onClick={onOpenCreateServer}
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#141519] text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 border border-[#26282E] transition-all duration-200 group-hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="absolute left-[80px] bg-[#18191D] text-slate-100 text-xs px-3 py-1.5 rounded-md shadow-xl border border-[#26282E] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
            Criar Servidor
          </div>
        </div>

        {/* Join Server / Invite Action Button */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            id="rail-join-invite-btn"
            type="button"
            onClick={onOpenJoinInvite}
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#141519] text-[#F27D26] hover:bg-[#F27D26]/10 hover:border-[#F27D26]/50 border border-[#26282E] transition-all duration-200 group-hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Compass className="w-5 h-5" />
          </button>
          <div className="absolute left-[80px] bg-[#18191D] text-slate-100 text-xs px-3 py-1.5 rounded-md shadow-xl border border-[#26282E] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
            Entrar com Convite
          </div>
        </div>
      </div>
    </nav>
  );
};
