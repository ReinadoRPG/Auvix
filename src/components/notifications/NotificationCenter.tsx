import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Check,
  Trash2,
  AtSign,
  UserPlus,
  Info,
  CheckCheck,
  Hash,
  X,
  ExternalLink,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useServer } from '../../context/ServerContext';
import { Notification } from '../../types';

interface NotificationCenterProps {
  onNavigateToChannel?: (serverId: string, channelId: string, messageId?: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNavigateToChannel }) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setHighlightedMessageId,
  } = useNotifications();

  const { selectServer, selectChannel, servers } = useServer();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'MENTIONS'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.readAt;
    if (filter === 'MENTIONS') return n.type === 'MENTION';
    return true;
  });

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.readAt) {
      markAsRead(notif.id);
    }

    if (notif.serverId && notif.channelId) {
      if (onNavigateToChannel) {
        onNavigateToChannel(notif.serverId, notif.channelId, notif.messageId);
      } else {
        const targetServer = servers.find((s) => s.id === notif.serverId);
        if (targetServer) {
          await selectServer(targetServer);
          await selectChannel(notif.channelId);
        }
      }

      if (notif.messageId) {
        setHighlightedMessageId(notif.messageId);
      }
      setIsOpen(false);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'agora mesmo';
    if (diffMin < 60) return `há ${diffMin} min`;
    if (diffHour < 24) return `há ${diffHour}h`;
    if (diffDay === 1) return 'ontem';
    return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        id="notification-bell-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
          isOpen
            ? 'bg-[#F27D26]/20 text-[#FF9345]'
            : 'text-slate-400 hover:text-slate-200 hover:bg-[#18191D]'
        }`}
        title="Central de Notificações"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#F27D26] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-[#F27D26]/40 animate-pulse border-2 border-[#121316]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div className="absolute right-0 top-11 w-84 sm:w-96 max-h-[520px] bg-[#121316] border border-[#26282E] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-[#18191D] border-b border-[#26282E] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#F27D26]" />
              <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wider">Notificações</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#F27D26]/20 border border-[#F27D26]/40 text-[#FF9345] text-[10px] font-bold rounded-full">
                  {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-[#FF9345] hover:bg-[#26282E] rounded-md transition flex items-center gap-1 cursor-pointer"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Ler todas</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#26282E] rounded-md transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="px-3 pt-2 pb-1.5 bg-[#121316] border-b border-[#1E2024] flex gap-1">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                filter === 'ALL'
                  ? 'bg-[#26282E] text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#18191D]'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('UNREAD')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                filter === 'UNREAD'
                  ? 'bg-[#26282E] text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#18191D]'
              }`}
            >
              Não lidas ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('MENTIONS')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition flex items-center gap-1 ${
                filter === 'MENTIONS'
                  ? 'bg-[#26282E] text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#18191D]'
              }`}
            >
              <AtSign className="w-3 h-3 text-[#F27D26]" />
              <span>Menções</span>
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#1E2024] max-h-[380px] no-scrollbar">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center text-slate-500">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-400">Nenhuma notificação por aqui</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {filter === 'UNREAD'
                    ? 'Você já leu todas as suas notificações!'
                    : 'Menções e alertas em tempo real aparecerão aqui.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isUnread = !notif.readAt;
                return (
                  <div
                    key={notif.id}
                    className={`group relative p-3 transition flex gap-3 cursor-pointer ${
                      isUnread ? 'bg-[#181A1F] hover:bg-[#1E2128]' : 'bg-[#121316] hover:bg-[#18191D]'
                    }`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    {/* Unread indicator bar */}
                    {isUnread && (
                      <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#F27D26] rounded-r-full" />
                    )}

                    {/* Actor avatar / icon */}
                    <div className="relative shrink-0 pt-0.5">
                      <img
                        src={
                          notif.actor?.avatarUrl ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${notif.actor?.username || notif.actorUserId}`
                        }
                        alt="Avatar"
                        className="w-8 h-8 rounded-lg object-cover bg-[#1E2024] border border-[#2A2D36]"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#121316] flex items-center justify-center border border-[#26282E]">
                        {notif.type === 'MENTION' ? (
                          <AtSign className="w-2.5 h-2.5 text-[#F27D26]" />
                        ) : notif.type === 'FRIEND_REQUEST' ? (
                          <UserPlus className="w-2.5 h-2.5 text-emerald-400" />
                        ) : (
                          <Info className="w-2.5 h-2.5 text-blue-400" />
                        )}
                      </div>
                    </div>

                    {/* Body content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1 mb-0.5">
                        <span className="font-bold text-xs text-slate-200 truncate">
                          {notif.title}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      {/* Location tags if server/channel */}
                      {(notif.serverName || notif.channelName) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                          {notif.serverName && (
                            <span className="font-semibold text-slate-300 truncate max-w-[120px]">
                              {notif.serverName}
                            </span>
                          )}
                          {notif.channelName && (
                            <span className="inline-flex items-center gap-0.5 text-[#FF9345] truncate max-w-[120px]">
                              <Hash className="w-2.5 h-2.5" />
                              {notif.channelName}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Message preview snippet */}
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed break-words">
                        {notif.body}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="shrink-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notif.id);
                          }}
                          className="p-1 hover:bg-[#26282E] text-slate-400 hover:text-emerald-400 rounded transition"
                          title="Marcar como lida"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                        className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition"
                        title="Remover notificação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
