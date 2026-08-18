import React, { useState } from 'react';
import { useServer } from '../../context/ServerContext';
import { X, Hash, Volume2 } from 'lucide-react';
import { ChannelType } from '../../types';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: ChannelType;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'TEXT',
}) => {
  const { createChannel, activeServer } = useServer();
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>(defaultType);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !activeServer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o nome do canal.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createChannel(name.trim(), type, topic.trim() || undefined);
      setName('');
      setTopic('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar canal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-[#121316] border border-[#26282E] rounded-xl shadow-2xl p-6 text-slate-100">
        <button
          id="close-create-channel-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-100">Criar Canal</h2>
          <p className="text-xs text-slate-400 mt-1">no servidor <span className="font-semibold text-slate-300">{activeServer.name}</span></p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel Type Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Tipo de Canal
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('TEXT')}
                className={`p-3 rounded-lg border flex flex-col items-start gap-1 transition cursor-pointer text-left ${
                  type === 'TEXT'
                    ? 'bg-[#F27D26]/15 border-[#F27D26] text-white ring-1 ring-[#F27D26]/30'
                    : 'bg-[#18191D] border-[#26282E] text-slate-400 hover:bg-[#202228]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Hash className="w-4 h-4 text-[#F27D26]" />
                  <span className="text-slate-100">Canal de Texto</span>
                </div>
                <span className="text-[11px] text-slate-400 leading-snug">
                  Mensagens, fotos, áudios e figurinhas.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setType('VOICE')}
                className={`p-3 rounded-lg border flex flex-col items-start gap-1 transition cursor-pointer text-left ${
                  type === 'VOICE'
                    ? 'bg-[#F27D26]/15 border-[#F27D26] text-white ring-1 ring-[#F27D26]/30'
                    : 'bg-[#18191D] border-[#26282E] text-slate-400 hover:bg-[#202228]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Volume2 className="w-4 h-4 text-[#FF9345]" />
                  <span className="text-slate-100">Canal de Voz</span>
                </div>
                <span className="text-[11px] text-slate-400 leading-snug">
                  Conversas de voz e vídeo em tempo real.
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nome do Canal
            </label>
            <div className="relative">
              {type === 'TEXT' ? (
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              ) : (
                <Volume2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              )}
              <input
                id="create-channel-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: bate-papo, jogos, resenha"
                className="w-full bg-[#18191D] border border-[#26282E] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tópico ou Descrição (opcional)
            </label>
            <input
              id="create-channel-topic-input"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Sobre o que é esse canal?"
              className="w-full bg-[#18191D] border border-[#26282E] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
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
              id="submit-create-channel-btn"
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2.5 bg-[#F27D26] hover:bg-[#FF9345] disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-md shadow-[#F27D26]/20 transition cursor-pointer"
            >
              {loading ? 'Criando...' : 'Criar Canal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
