import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import { uploadApi } from '../../services/api';
import { UserStatus } from '../../types';
import {
  X,
  User as UserIcon,
  Mic,
  Video,
  Shield,
  LogOut,
  Check,
  Upload,
  Camera,
  Activity,
} from 'lucide-react';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile, logout } = useAuth();
  const { isMuted } = useVoice();

  const [activeTab, setActiveTab] = useState<'PROFILE' | 'VOICE_VIDEO' | 'ACCOUNT'>('PROFILE');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [bannerUrl, setBannerUrl] = useState(user?.bannerUrl || '');
  const [customStatus, setCustomStatus] = useState(user?.customStatus || '');
  const [status, setStatus] = useState<UserStatus>(user?.status || 'ONLINE');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Audio testing
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);
  const [cameraTesting, setCameraTesting] = useState(false);
  const testVideoRef = useRef<HTMLVideoElement>(null);
  const testMediaStreamRef = useRef<MediaStream | null>(null);
  const testAudioCtxRef = useRef<AudioContext | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setUsername(user.username);
      setBio(user.bio || '');
      setAvatarUrl(user.avatarUrl || '');
      setBannerUrl(user.bannerUrl || '');
      setCustomStatus(user.customStatus || '');
      setStatus(user.status);
    }
  }, [user]);

  useEffect(() => {
    return () => {
      stopTesting();
    };
  }, []);

  const stopTesting = () => {
    if (testMediaStreamRef.current) {
      testMediaStreamRef.current.getTracks().forEach((t) => t.stop());
      testMediaStreamRef.current = null;
    }
    if (testAudioCtxRef.current) {
      testAudioCtxRef.current.close();
      testAudioCtxRef.current = null;
    }
    setCameraTesting(false);
  };

  const handleTestMicAndCamera = async () => {
    if (cameraTesting) {
      stopTesting();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      testMediaStreamRef.current = stream;
      setCameraTesting(true);

      if (testVideoRef.current) {
        testVideoRef.current.srcObject = stream;
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        testAudioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkLevel = () => {
          if (!testAudioCtxRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setMicVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
          requestAnimationFrame(checkLevel);
        };
        requestAnimationFrame(checkLevel);
      }
    } catch (err) {
      console.warn('Media testing error:', err);
      alert('Erro ao testar microfone e câmera. Verifique suas permissões no navegador.');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const res = await uploadApi.uploadFile(file);
      setAvatarUrl(res.url);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar foto de perfil');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBanner(true);
    try {
      const res = await uploadApi.uploadFile(file);
      setBannerUrl(res.url);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar banner');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        username: username.trim(),
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        bannerUrl: bannerUrl.trim() || undefined,
        customStatus: customStatus.trim() || undefined,
        status,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar alterações do perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-[#121316] border border-[#26282E] rounded-2xl shadow-2xl overflow-hidden flex h-[600px] text-slate-100">
        {/* Close Button */}
        <button
          id="close-user-settings-btn"
          type="button"
          onClick={() => {
            stopTesting();
            onClose();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition cursor-pointer z-10 p-1.5 rounded-lg hover:bg-[#1e222b]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Sidebar Tabs */}
        <div className="w-52 bg-[#0E0F12] p-4 flex flex-col justify-between border-r border-[#1E2024] shrink-0">
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 py-2">
              Configurações
            </div>

            <button
              id="tab-profile-btn"
              type="button"
              onClick={() => setActiveTab('PROFILE')}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                activeTab === 'PROFILE'
                  ? 'bg-[#F27D26]/15 text-[#FF9345] border border-[#F27D26]/40'
                  : 'text-slate-400 hover:bg-[#18191D] hover:text-slate-200'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>Meu Perfil</span>
            </button>

            <button
              id="tab-voice-video-btn"
              type="button"
              onClick={() => setActiveTab('VOICE_VIDEO')}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                activeTab === 'VOICE_VIDEO'
                  ? 'bg-[#F27D26]/15 text-[#FF9345] border border-[#F27D26]/40'
                  : 'text-slate-400 hover:bg-[#18191D] hover:text-slate-200'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Voz e Vídeo</span>
            </button>

            <button
              id="tab-account-btn"
              type="button"
              onClick={() => setActiveTab('ACCOUNT')}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                activeTab === 'ACCOUNT'
                  ? 'bg-[#F27D26]/15 text-[#FF9345] border border-[#F27D26]/40'
                  : 'text-slate-400 hover:bg-[#18191D] hover:text-slate-200'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Minha Conta</span>
            </button>
          </div>

          <div>
            <button
              id="settings-logout-btn"
              type="button"
              onClick={() => {
                stopTesting();
                logout();
                onClose();
              }}
              className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-600/15 flex items-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
          {/* PROFILE TAB */}
          {activeTab === 'PROFILE' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
              <div>
                <h2 className="text-base font-bold text-slate-100">Perfil de Usuário</h2>
                <p className="text-xs text-slate-400">
                  Personalize como as pessoas veem sua identidade no Auvix.
                </p>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Status de Presença
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'ONLINE', label: 'Disponível', color: 'bg-emerald-500' },
                    { val: 'IDLE', label: 'Ausente', color: 'bg-amber-500' },
                    { val: 'DO_NOT_DISTURB', label: 'Não Perturbar', color: 'bg-rose-500' },
                    { val: 'INVISIBLE', label: 'Invisível', color: 'bg-slate-500' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setStatus(item.val as UserStatus)}
                      className={`px-3 py-2 rounded-xl border flex items-center gap-2 text-xs font-medium transition cursor-pointer ${
                        status === item.val || (item.val === 'DO_NOT_DISTURB' && (status as string) === 'DND')
                          ? 'bg-[#18191D] border-[#F27D26] text-white ring-1 ring-[#F27D26]/40'
                          : 'bg-[#18191D] border-[#26282E] text-slate-400 hover:bg-[#202228]'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Name & Username */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Nome de Exibição
                  </label>
                  <input
                    id="settings-displayname-input"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: Victinnx"
                    className="w-full bg-[#18191D] border border-[#26282E] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Nome de Usuário (@handle)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs text-slate-500 font-mono">@</span>
                    <input
                      id="settings-username-input"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                      className="w-full bg-[#18191D] border border-[#26282E] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-xl pl-7 pr-3 py-2 text-xs font-mono text-slate-100 outline-none transition"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Status Personalizado
                </label>
                <input
                  id="settings-custom-status-input"
                  type="text"
                  value={customStatus}
                  onChange={(e) => setCustomStatus(e.target.value)}
                  placeholder="Ex: Desenvolvendo no Auvix..."
                  className="w-full bg-[#18191D] border border-[#26282E] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none transition"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Sobre Mim (Bio)
                </label>
                <textarea
                  id="settings-bio-input"
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Escreva algo sobre você..."
                  className="w-full bg-[#18191D] border border-[#26282E] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none transition resize-none"
                />
              </div>

              {/* Avatar and Banner Upload */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Foto de Perfil
                  </label>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="px-3 py-2 bg-[#18191D] hover:bg-[#22252e] border border-[#26282E] text-slate-300 text-xs font-medium rounded-xl flex items-center gap-2 transition"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#F27D26]" />
                      <span>{isUploadingAvatar ? 'Enviando...' : 'Carregar Imagem'}</span>
                    </button>
                    {avatarUrl && (
                      <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-[#26282E]" />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Banner de Perfil
                  </label>
                  <input
                    type="file"
                    ref={bannerInputRef}
                    onChange={handleBannerUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={isUploadingBanner}
                    className="px-3 py-2 bg-[#18191D] hover:bg-[#22252e] border border-[#26282E] text-slate-300 text-xs font-medium rounded-xl flex items-center gap-2 transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isUploadingBanner ? 'Enviando...' : 'Carregar Banner'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  id="save-profile-btn"
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#F27D26] hover:bg-[#FF9345] disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-md shadow-[#F27D26]/20 transition flex items-center gap-2 cursor-pointer"
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Salvo com Sucesso!</span>
                    </>
                  ) : (
                    <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* VOICE & VIDEO TAB */}
          {activeTab === 'VOICE_VIDEO' && (
            <div className="space-y-5 max-w-lg">
              <div>
                <h2 className="text-base font-bold text-slate-100">Voz e Vídeo</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Teste seus dispositivos de áudio e câmera antes de entrar em chamadas.
                </p>
              </div>

              {/* Live Mic Test Meter */}
              <div className="bg-[#18191D] border border-[#26282E] p-4 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#F27D26]" />
                    Sensibilidade do Microfone
                  </span>
                  <span className="text-[#FF9345] font-mono">{micVolumeLevel}%</span>
                </div>

                <div className="w-full h-3 bg-[#0E0F12] rounded-full overflow-hidden p-0.5 border border-[#26282E]">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-[#F27D26] to-rose-500 rounded-full transition-all duration-75"
                    style={{ width: `${micVolumeLevel}%` }}
                  />
                </div>
              </div>

              {/* Live Camera Preview */}
              <div className="bg-[#18191D] border border-[#26282E] p-4 rounded-xl space-y-2.5">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-[#F27D26]" />
                    Visualização da Câmera
                  </span>
                </div>

                <div className="relative w-full h-44 bg-[#0E0F12] rounded-xl overflow-hidden border border-[#26282E] flex items-center justify-center">
                  <video
                    ref={testVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  {!cameraTesting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-xs">
                      <Camera className="w-6 h-6 mb-2 text-slate-600" />
                      <span>Câmera desligada no momento</span>
                    </div>
                  )}
                </div>

                <button
                  id="test-devices-btn"
                  type="button"
                  onClick={handleTestMicAndCamera}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    cameraTesting
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                      : 'bg-[#F27D26] hover:bg-[#FF9345] text-white shadow-md shadow-[#F27D26]/20'
                  }`}
                >
                  {cameraTesting ? 'Parar Teste de Dispositivos' : 'Iniciar Teste de Microfone e Câmera'}
                </button>
              </div>
            </div>
          )}

          {/* ACCOUNT TAB */}
          {activeTab === 'ACCOUNT' && (
            <div className="space-y-4 max-w-lg">
              <h2 className="text-base font-bold text-slate-100">Minha Conta</h2>

              <div className="bg-[#18191D] border border-[#26282E] p-5 rounded-xl space-y-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">ID de Usuário</div>
                  <div className="text-xs font-mono text-[#FF9345] select-all mt-0.5">{user.id}</div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email Cadastrado</div>
                  <div className="text-xs text-slate-200 mt-0.5">{user.email}</div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Membro desde</div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    {new Date(user.createdAt).toLocaleDateString([], {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#1E2024]">
                <button
                  type="button"
                  onClick={() => {
                    stopTesting();
                    logout();
                    onClose();
                  }}
                  className="px-4 py-2.5 bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600 hover:text-white text-rose-400 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Encerrar Sessão
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
