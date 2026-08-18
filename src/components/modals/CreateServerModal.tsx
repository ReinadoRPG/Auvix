import React, { useState } from 'react';
import { useServer } from '../../context/ServerContext';
import { X, Sparkles, Image, ArrowRight } from 'lucide-react';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({ isOpen, onClose }) => {
  const { createServer } = useServer();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o nome do servidor.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createServer(
        name.trim(),
        description.trim() || undefined,
        iconUrl.trim() || undefined
      );
      setName('');
      setDescription('');
      setIconUrl('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-[#121316] border border-[#26282E] rounded-xl shadow-2xl p-6 text-slate-100">
        <button
          id="close-create-server-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#F27D26]/15 border border-[#F27D26]/30 flex items-center justify-center text-[#F27D26] mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Criar um Servidor</h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Crie um espaço exclusivo para conversar por voz, vídeo e texto com seus amigos.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nome do Servidor
            </label>
            <input
              id="create-server-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Servidor dos Amigos, Galera dos Games..."
              className="w-full bg-[#18191D] border border-[#26282E] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Descrição (opcional)
            </label>
            <input
              id="create-server-desc-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Um cantinho pra jogar conversa fora..."
              className="w-full bg-[#18191D] border border-[#26282E] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Foto ou Ícone do Servidor (opcional)
            </label>
            <div className="relative">
              <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="create-server-icon-input"
                type="url"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="Link da imagem (https://...)"
                className="w-full bg-[#18191D] border border-[#26282E] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>
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
              id="submit-create-server-btn"
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2.5 bg-[#F27D26] hover:bg-[#FF9345] disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-md shadow-[#F27D26]/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{loading ? 'Criando...' : 'Criar Servidor'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
