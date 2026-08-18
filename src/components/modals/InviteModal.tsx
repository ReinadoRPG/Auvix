import React, { useState, useEffect } from 'react';
import { useServer } from '../../context/ServerContext';
import { X, Copy, Check, UserPlus, Compass, ArrowRight } from 'lucide-react';
import { Invite } from '../../types';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'INVITE' | 'JOIN';
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  mode = 'INVITE',
}) => {
  const { activeServer, createInvite, joinInvite } = useServer();
  const [currentMode, setCurrentMode] = useState<'INVITE' | 'JOIN'>(mode);
  const [inviteCode, setInviteCode] = useState('');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  useEffect(() => {
    if (isOpen && currentMode === 'INVITE' && activeServer) {
      loadServerInvite();
    }
  }, [isOpen, currentMode, activeServer]);

  const loadServerInvite = async () => {
    if (!activeServer) return;
    setLoading(true);
    setError(null);
    try {
      const inv = await createInvite(activeServer.id);
      setInvite(inv);
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar convite.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!invite) return;
    const text = invite.code;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError('Por favor, informe o código do convite.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await joinInvite(inviteCode.trim());
      setInviteCode('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Convite inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-[#121316] border border-[#26282E] rounded-xl shadow-2xl p-6 text-slate-100">
        <button
          id="close-invite-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {currentMode === 'INVITE' ? (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#F27D26]/15 border border-[#F27D26]/30 flex items-center justify-center text-[#F27D26] mx-auto mb-3">
                <UserPlus className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-100">
                Convidar amigos para {activeServer?.name}
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Compartilhe esse código com quem você quiser chamar para o servidor!
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">
                Código de Convite
              </label>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#18191D] border border-[#26282E] rounded-lg px-3 py-2.5 text-sm font-mono text-[#FF9345] select-all truncate">
                  {loading ? 'Gerando código...' : invite?.code || 'auvix-welcome'}
                </div>

                <button
                  id="copy-invite-btn"
                  type="button"
                  onClick={handleCopy}
                  disabled={loading}
                  className="px-4 py-2.5 bg-[#F27D26] hover:bg-[#FF9345] text-white text-xs font-semibold rounded-lg shadow-md shadow-[#F27D26]/20 transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-400 text-center pt-2">
                Seus amigos só precisam colar esse código para entrar no servidor.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#F27D26]/15 border border-[#F27D26]/30 flex items-center justify-center text-[#F27D26] mx-auto mb-3">
                <Compass className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-100">
                Conectar a um Servidor?
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Insira o código do servidor abaixo para entrar na conversa com a galera.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Código de Convite
                </label>
                <input
                  id="join-invite-code-input"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="ex: auvix-welcome ou o código do servidor"
                  className="w-full bg-[#18191D] border border-[#26282E] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="submit-join-invite-btn"
                  type="submit"
                  disabled={loading || !inviteCode.trim()}
                  className="px-4 py-2.5 bg-[#F27D26] hover:bg-[#FF9345] disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-md shadow-[#F27D26]/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{loading ? 'Entrando...' : 'Entrar no Servidor'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
