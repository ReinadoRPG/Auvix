import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { useFriends } from '../../context/FriendsContext';
import { useNotifications } from '../../context/NotificationContext';
import { uploadApi } from '../../services/api';
import { AudioPlayer } from './AudioPlayer';
import {
  Hash,
  Send,
  Smile,
  Users,
  Trash2,
  Paperclip,
  X,
  FileAudio,
  Image as ImageIcon,
  AtSign,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { ServerMember } from '../../types';

interface ChatAreaProps {
  onToggleMembers: () => void;
  showMembers: boolean;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🚀', '😂', '🎉'];

const isAudioFile = (url: string) => {
  return /\.(mp3|wav|ogg|m4a|aac|flac|webm)($|\?)/i.test(url) || url.includes('/audio');
};

const isImageFile = (url: string) => {
  return /\.(jpeg|jpg|png|gif|webp|svg)($|\?)/i.test(url) || url.includes('/image');
};

export const ChatArea: React.FC<ChatAreaProps> = ({ onToggleMembers, showMembers }) => {
  const {
    activeServer,
    activeChannel,
    messages,
    loadingMessages,
    sendMessage,
    toggleReaction,
    deleteMessage,
    typingUsers,
    sendTyping,
    serverMembers,
  } = useServer();
  const { user } = useAuth();
  const { openUserProfile } = useFriends();
  const { highlightedMessageId } = useNotifications();

  const [inputContent, setInputContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Array<{ url: string; filename: string; mimetype?: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Mention Autocomplete State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCursorIndex, setMentionCursorIndex] = useState<number>(-1);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const highlightedMessageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (highlightedMessageId) {
      setTimeout(() => {
        highlightedMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else {
      scrollToBottom();
    }
  }, [messages, highlightedMessageId]);

  // Mention suggestion list
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];

    const query = mentionQuery.toLowerCase();
    const suggestions: Array<{
      id: string;
      type: 'USER' | 'EVERYONE' | 'HERE';
      label: string;
      sublabel: string;
      avatarUrl?: string;
      status?: string;
      handle: string;
    }> = [];

    // Special broadcast mentions
    if ('everyone'.includes(query) || query === '') {
      suggestions.push({
        id: 'mention_everyone',
        type: 'EVERYONE',
        label: '@everyone',
        sublabel: 'Notifica todos os membros deste servidor',
        handle: 'everyone',
      });
    }

    if ('here'.includes(query) || query === '') {
      suggestions.push({
        id: 'mention_here',
        type: 'HERE',
        label: '@here',
        sublabel: 'Notifica apenas os membros online agora',
        handle: 'here',
      });
    }

    // Server members
    serverMembers.forEach((member) => {
      const u = member.user;
      if (!u) return;

      const usernameMatch = u.username.toLowerCase().includes(query);
      const nameMatch = (u.displayName || '').toLowerCase().includes(query);

      if (usernameMatch || nameMatch) {
        suggestions.push({
          id: u.id,
          type: 'USER',
          label: u.displayName || u.username,
          sublabel: `@${u.username}`,
          avatarUrl: u.avatarUrl,
          status: u.status,
          handle: u.username,
        });
      }
    });

    return suggestions.slice(0, 8);
  }, [mentionQuery, serverMembers]);

  // Reset selected mention index when suggestions change
  useEffect(() => {
    setMentionSelectedIndex(0);
  }, [mentionSuggestions.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || val.length;
    setInputContent(val);

    // Detect if user is typing a mention (@...)
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Ensure the @ is at start or preceded by whitespace
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (/\s/.test(charBeforeAt)) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (!/\s/.test(query)) {
          setMentionQuery(query);
          setMentionCursorIndex(lastAtIndex);
        } else {
          setMentionQuery(null);
        }
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }

    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  const applyMention = (handle: string) => {
    if (mentionCursorIndex === -1) return;
    const before = inputContent.slice(0, mentionCursorIndex);
    const after = inputContent.slice(inputRef.current?.selectionStart || (mentionCursorIndex + (mentionQuery?.length || 0) + 1));
    const newContent = `${before}@${handle} ${after}`;
    setInputContent(newContent);
    setMentionQuery(null);
    setMentionCursorIndex(-1);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = before.length + handle.length + 2;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = mentionSuggestions[mentionSelectedIndex];
        if (selected) {
          applyMention(selected.handle);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      const res = await uploadApi.uploadFile(file);
      setAttachments((prev) => [...prev, { url: res.url, filename: res.filename, mimetype: res.mimetype }]);
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao enviar anexo');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() && attachments.length === 0) return;

    const attachmentUrls = attachments.map((a) => a.url);
    sendMessage(inputContent.trim(), attachmentUrls.length > 0 ? attachmentUrls : undefined);

    setInputContent('');
    setAttachments([]);
    setMentionQuery(null);
    sendTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  // Render parsed message content with styled @mentions
  const renderMessageContent = (content: string) => {
    // Regex for mentions: @everyone, @here, @username, <@userId>
    const mentionRegex = /(@everyone|@here|@[a-zA-Z0-9_.]+|&lt;@[a-zA-Z0-9_-]+&gt;|<@[a-zA-Z0-9_-]+>)/g;
    const parts = content.split(mentionRegex);

    return parts.map((part, i) => {
      if (!part) return null;

      if (part === '@everyone' || part === '@here') {
        return (
          <span
            key={i}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold text-[11px] border border-amber-500/30 select-all"
          >
            <Sparkles className="w-2.5 h-2.5" />
            {part}
          </span>
        );
      }

      if (part.startsWith('@')) {
        const username = part.slice(1);
        const isMyMention = user && user.username.toLowerCase() === username.toLowerCase();
        return (
          <span
            key={i}
            className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded font-semibold text-[11px] transition cursor-pointer select-all ${
              isMyMention
                ? 'bg-[#F27D26]/25 text-[#FF9345] border border-[#F27D26]/40 font-bold'
                : 'bg-[#F27D26]/15 text-[#FF9345] hover:bg-[#F27D26]/25'
            }`}
          >
            {part}
          </span>
        );
      }

      if (part.startsWith('<@') && part.endsWith('>')) {
        const userId = part.slice(2, -1);
        const matchedMember = serverMembers.find((m) => m.userId === userId);
        const displayName = matchedMember?.user?.displayName || matchedMember?.user?.username || 'membro';
        const isMyMention = user && user.id === userId;

        return (
          <span
            key={i}
            className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded font-semibold text-[11px] transition cursor-pointer select-all ${
              isMyMention
                ? 'bg-[#F27D26]/25 text-[#FF9345] border border-[#F27D26]/40 font-bold'
                : 'bg-[#F27D26]/15 text-[#FF9345] hover:bg-[#F27D26]/25'
            }`}
          >
            @{displayName}
          </span>
        );
      }

      return <span key={i}>{part}</span>;
    });
  };

  if (!activeChannel) {
    return (
      <div className="flex-1 h-full bg-[#0A0A0C] flex flex-col items-center justify-center text-slate-500">
        <Hash className="w-10 h-10 text-[#F27D26]/40 mb-2 stroke-[1.5]" />
        <p className="text-xs text-slate-400 font-medium">Selecione um canal para conversar</p>
      </div>
    );
  }

  return (
    <main aria-label="Área de Conversa" className="flex-1 h-full bg-[#0A0A0C] flex flex-col min-w-0 z-10 relative">
      {/* CHANNEL HEADER */}
      <div className="h-12 px-4 bg-[#121316] border-b border-[#1E2024] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 truncate">
          <Hash className="w-4 h-4 text-[#F27D26] shrink-0" />
          <span className="font-bold text-xs text-slate-100 truncate">{activeChannel.name}</span>
          {activeChannel.topic && (
            <>
              <div className="w-px h-3.5 bg-[#26282E] mx-2" />
              <span className="text-xs text-slate-400 truncate max-w-md">{activeChannel.topic}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            id="toggle-members-sidebar-btn"
            type="button"
            onClick={onToggleMembers}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              showMembers
                ? 'bg-[#F27D26]/15 border-[#F27D26]/40 text-[#F27D26]'
                : 'text-slate-400 hover:bg-[#18191D] border-transparent hover:text-slate-200'
            }`}
            title="Membros do Servidor"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MESSAGES SCROLL AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
        {/* Welcome Channel Banner */}
        <div className="p-4 rounded-xl bg-[#121316] border border-[#26282E] mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F27D26]/10 border border-[#F27D26]/30 flex items-center justify-center text-[#F27D26]">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Bem-vindo a #{activeChannel.name}!</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Este é o início das mensagens no canal #{activeChannel.name}. Use <span className="text-[#FF9345] font-mono">@</span> para mencionar membros.
              </p>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {loadingMessages && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#F27D26] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Message List */}
        {messages.map((msg, index) => {
          const isMe = user?.id === msg.authorId;
          const prevMsg = messages[index - 1];
          const isCompact =
            prevMsg &&
            prevMsg.authorId === msg.authorId &&
            new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000;

          // Check if this message mentions the current user or @everyone/@here
          const isMentioningMe =
            user &&
            (msg.mentions?.includes(user.id) ||
              msg.content.toLowerCase().includes(`@${user.username.toLowerCase()}`) ||
              msg.content.includes(`@everyone`) ||
              msg.content.includes(`@here`));

          const isHighlighted = highlightedMessageId === msg.id;

          return (
            <div
              key={msg.id}
              ref={isHighlighted ? highlightedMessageRef : null}
              className={`group relative flex gap-3 px-3 py-1.5 rounded-xl transition border ${
                isHighlighted
                  ? 'bg-[#F27D26]/20 border-[#F27D26] ring-2 ring-[#F27D26]/40 shadow-lg shadow-[#F27D26]/10 animate-pulse'
                  : isMentioningMe
                  ? 'bg-[#F27D26]/8 border-l-2 border-l-[#F27D26] border-t-transparent border-r-transparent border-b-transparent'
                  : 'hover:bg-[#121316] border-transparent hover:border-[#1E2024]'
              } ${isCompact ? 'pt-0.5' : 'mt-2'}`}
            >
              {!isCompact ? (
                <div
                  className="relative shrink-0 pt-0.5 cursor-pointer"
                  onClick={() => msg.author && openUserProfile(msg.author)}
                >
                  <img
                    src={
                      msg.author?.avatarUrl ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.author?.username || 'user'}`
                    }
                    alt={msg.author?.displayName || msg.author?.username}
                    className="w-8 h-8 rounded-lg object-cover bg-[#18191D] border border-[#26282E]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="w-8 shrink-0 text-right pr-1">
                  <span className="text-[9px] font-mono text-slate-600 opacity-0 group-hover:opacity-100 select-none">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                {!isCompact && (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span
                      onClick={() => msg.author && openUserProfile(msg.author)}
                      className="font-bold text-xs text-[#FF9345] hover:underline cursor-pointer"
                    >
                      {msg.author?.displayName || msg.author?.username || 'Usuário'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      @{msg.author?.username}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(msg.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })} •{' '}
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}

                {/* Message Content */}
                {msg.content && (
                  <div className="text-xs text-slate-200 leading-relaxed break-words whitespace-pre-wrap selection:bg-[#F27D26] selection:text-white">
                    {renderMessageContent(msg.content)}
                  </div>
                )}

                {/* Attachments: Audio Player and Images */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2">
                    {msg.attachments.map((attUrl, i) => {
                      if (isAudioFile(attUrl)) {
                        return <AudioPlayer key={i} src={attUrl} filename={`Áudio (${i + 1})`} />;
                      }

                      if (isImageFile(attUrl)) {
                        return (
                          <a
                            key={i}
                            href={attUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block max-w-sm rounded-xl overflow-hidden border border-[#26282E] bg-[#141519] hover:border-[#F27D26]/50 transition"
                          >
                            <img src={attUrl} alt="Anexo" className="max-h-64 w-auto object-cover" />
                          </a>
                        );
                      }

                      return (
                        <a
                          key={i}
                          href={attUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#18191D] border border-[#26282E] text-xs text-slate-300 hover:text-white hover:border-[#F27D26]/40 transition max-w-xs"
                        >
                          <Paperclip className="w-4 h-4 text-[#F27D26]" />
                          <span className="truncate">Download do anexo</span>
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Reactions List */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {msg.reactions.map((r) => {
                      const hasReacted = user && r.userIds.includes(user.id);
                      return (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => toggleReaction(msg.id, r.emoji)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition cursor-pointer active:scale-95 ${
                            hasReacted
                              ? 'bg-[#F27D26]/20 border-[#F27D26]/50 text-[#FF9345]'
                              : 'bg-[#18191D] border-[#26282E] text-slate-400 hover:bg-[#202228] hover:text-slate-200'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span className="text-[10px] font-bold">{r.count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Message Hover Floating Action Toolbar */}
              <div className="absolute right-3 -top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-[#18191D] border border-[#26282E] rounded-md shadow-lg flex items-center p-0.5 gap-0.5 z-10">
                {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => toggleReaction(msg.id, emoji)}
                    className="p-1 hover:bg-[#26282E] rounded text-xs transition cursor-pointer"
                    title={`Reagir com ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                  className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#26282E] rounded transition cursor-pointer"
                  title="Mais Reações"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>

                {isMe && (
                  <button
                    type="button"
                    onClick={() => deleteMessage(msg.id)}
                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 rounded transition cursor-pointer"
                    title="Excluir mensagem"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Extended Emoji Picker Popup */}
              {showEmojiPicker === msg.id && (
                <div className="absolute right-3 top-6 bg-[#18191D] border border-[#26282E] rounded-lg p-1.5 shadow-2xl z-20 flex gap-1">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        toggleReaction(msg.id, emoji);
                        setShowEmojiPicker(null);
                      }}
                      className="p-1.5 hover:bg-[#F27D26]/20 rounded text-sm transition cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* TYPING INDICATORS BAR */}
      <div className="h-5 px-4 flex items-center text-[11px] text-slate-500 shrink-0">
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-1.5 text-[#F27D26] animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F27D26]" />
            <span>
              {typingUsers.map((u) => u.username).join(', ')}{' '}
              {typingUsers.length === 1 ? 'está digitando...' : 'estão digitando...'}
            </span>
          </div>
        )}
      </div>

      {/* MENTION AUTOCOMPLETE FLOATING POPUP */}
      {mentionQuery !== null && mentionSuggestions.length > 0 && (
        <div className="absolute bottom-20 left-4 right-4 max-w-md bg-[#18191D] border border-[#26282E] rounded-xl shadow-2xl z-30 overflow-hidden divide-y divide-[#22242B] animate-in fade-in slide-in-from-bottom-2 duration-100">
          <div className="px-3 py-1.5 bg-[#121316] text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <AtSign className="w-3 h-3 text-[#F27D26]" />
            <span>Membros & Menções</span>
          </div>
          <div className="max-h-56 overflow-y-auto no-scrollbar py-1">
            {mentionSuggestions.map((item, idx) => {
              const isSelected = idx === mentionSelectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => applyMention(item.handle)}
                  className={`px-3 py-2 flex items-center gap-2.5 cursor-pointer transition ${
                    isSelected ? 'bg-[#F27D26]/20 text-white' : 'hover:bg-[#202228] text-slate-200'
                  }`}
                >
                  {item.type === 'EVERYONE' || item.type === 'HERE' ? (
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={item.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.handle}`}
                        alt={item.label}
                        className="w-7 h-7 rounded-lg object-cover bg-[#22242B] border border-[#2E313A]"
                      />
                      {item.status && (
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#18191D] ${
                            item.status === 'ONLINE'
                              ? 'bg-emerald-500'
                              : item.status === 'IDLE'
                              ? 'bg-amber-500'
                              : item.status === 'DO_NOT_DISTURB'
                              ? 'bg-rose-500'
                              : 'bg-zinc-500'
                          }`}
                        />
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs truncate">{item.label}</span>
                      {item.type === 'USER' && (
                        <span className="text-[10px] text-slate-400 font-mono">{item.sublabel}</span>
                      )}
                    </div>
                    {item.type !== 'USER' && (
                      <p className="text-[10px] text-slate-400 truncate">{item.sublabel}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MESSAGE INPUT COMPOSER */}
      <div className="px-4 pb-4 shrink-0">
        {/* Upload error banner */}
        {uploadError && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="p-0.5 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Uploaded attachments preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att, i) => (
              <div key={i} className="relative group bg-[#18191D] border border-[#26282E] rounded-xl p-1.5 flex items-center gap-2">
                {isAudioFile(att.url) ? (
                  <div className="w-10 h-10 rounded-lg bg-[#F27D26]/20 border border-[#F27D26]/40 flex items-center justify-center text-[#FF9345]">
                    <FileAudio className="w-5 h-5" />
                  </div>
                ) : isImageFile(att.url) ? (
                  <img src={att.url} alt="Upload" className="w-10 h-10 rounded-lg object-cover border border-[#26282E]" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#26282E] flex items-center justify-center text-slate-300">
                    <Paperclip className="w-5 h-5" />
                  </div>
                )}
                <div className="max-w-[120px] text-[11px] truncate text-slate-200">
                  {att.filename}
                </div>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="w-4 h-4 bg-rose-600 rounded-full text-white text-[10px] flex items-center justify-center hover:bg-rose-500"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSendMessage}
          className="relative bg-[#121316] border border-[#26282E] focus-within:border-[#F27D26] focus-within:ring-1 focus-within:ring-[#F27D26] rounded-xl flex items-center px-3 py-2 transition shadow-inner gap-2"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,audio/*,video/*,.pdf,.txt"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1e2129] transition-colors cursor-pointer"
            title="Anexar Imagem ou Áudio"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-[#F27D26] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>

          <input
            id="chat-message-input"
            ref={inputRef}
            type="text"
            value={inputContent}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Conversar em #${activeChannel.name} (use @ para mencionar)`}
            className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 outline-none"
          />

          <div className="flex items-center gap-1 shrink-0">
            <button
              id="chat-send-btn"
              type="submit"
              disabled={!inputContent.trim() && attachments.length === 0}
              className="p-1.5 bg-[#F27D26] hover:bg-[#FF9345] disabled:opacity-30 text-white rounded-lg transition cursor-pointer shadow-md shadow-[#F27D26]/20"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
