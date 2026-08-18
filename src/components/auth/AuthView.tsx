import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Lock, Mail, User as UserIcon, ArrowRight, Sparkles, Smile } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { login, loginWithGoogle, register, error, clearError } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (isRegistering) {
      if (!username.trim() || username.trim().length < 2) {
        setFormError('Escolha um nome de usuário com pelo menos 2 letras ou números.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setFormError('Por favor, digite um e-mail válido.');
        return;
      }
      if (password.length < 6) {
        setFormError('Sua senha precisa ter no mínimo 6 caracteres.');
        return;
      }

      setLoading(true);
      try {
        await register(username.trim(), email.trim(), password, displayName.trim() || undefined);
      } catch (err: any) {
        setFormError(err.message || 'Ops! Não conseguimos criar sua conta agora. Tente de novo.');
      } finally {
        setLoading(false);
      }
    } else {
      if (!email.trim()) {
        setFormError('Digite seu e-mail ou nome de usuário para entrar.');
        return;
      }
      if (!password) {
        setFormError('Não esqueça de preencher sua senha!');
        return;
      }

      setLoading(true);
      try {
        await login(email.trim(), password);
      } catch (err: any) {
        setFormError(err.message || 'E-mail ou senha incorretos.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setFormError(null);
    clearError();
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setFormError(err.message || 'Não foi possível entrar com o Google no momento.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#0C0D10] overflow-hidden text-slate-100 selection:bg-[#F27D26] selection:text-white p-4">
      {/* Background smooth ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(#1E2028_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
      <div className="absolute top-1/4 -left-32 w-80 h-80 bg-[#F27D26]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-[#FF9345]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-md bg-[#131418] border border-[#23252C] rounded-2xl shadow-2xl p-6 sm:p-8 z-10"
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#F27D26]/15 border border-[#F27D26]/30 text-[#F27D26] mb-3 shadow-lg shadow-[#F27D26]/10">
            <Radio className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            {isRegistering ? 'Bora criar sua conta!' : 'Pronto para conectar?'}
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-xs">
            {isRegistering
              ? 'Leva menos de um minuto para entrar nas conversas de voz, vídeo e texto com a galera.'
              : 'Entre na sua conta ou use o Google para encontrar sua turma e bater papo.'}
          </p>
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {(formError || error) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span className="leading-snug">{formError || error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google Authentication */}
        <div className="space-y-3 mb-5">
          <button
            id="firebase-google-auth-btn"
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full bg-[#191B21] hover:bg-[#22252D] border border-[#2B2E37] hover:border-[#383C47] text-slate-100 text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-3 transition cursor-pointer shadow-sm disabled:opacity-50"
          >
            {googleLoading ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.675-5.17 3.675-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.24v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.24C.45 8.18 0 9.94 0 12s.45 3.82 1.24 5.39l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.61l4.03 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>Entrar com o Google</span>
              </>
            )}
          </button>

          {/* Clean Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-[#23252C] w-full" />
            <span className="bg-[#131418] px-3 text-[11px] font-medium text-slate-500 shrink-0">
              ou com seu e-mail
            </span>
            <div className="border-t border-[#23252C] w-full" />
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegistering && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Como quer ser chamado? (seu @)
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="auth-username-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ex: gabriel, dudagamer, lucas"
                    className="w-full bg-[#18191E] border border-[#262830] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
                    disabled={loading || googleLoading}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nome de exibição (opcional)
                </label>
                <div className="relative">
                  <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="auth-displayname-input"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Como seus amigos vão te ver"
                    className="w-full bg-[#18191E] border border-[#262830] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
                    disabled={loading || googleLoading}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {isRegistering ? 'Seu melhor e-mail' : 'Seu e-mail ou nome de usuário'}
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="auth-email-input"
                type={isRegistering ? 'email' : 'text'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegistering ? 'voce@exemplo.com' : 'voce@exemplo.com ou @usuario'}
                className="w-full bg-[#18191E] border border-[#262830] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
                disabled={loading || googleLoading}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Sua senha secreta
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="auth-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha (mínimo 6 dígitos)"
                className="w-full bg-[#18191E] border border-[#262830] focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
                disabled={loading || googleLoading}
                required
              />
            </div>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading || googleLoading}
            className="w-full mt-2 bg-[#F27D26] hover:bg-[#FF9345] text-white text-sm font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-[#F27D26]/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{isRegistering ? 'Criar minha conta e começar' : 'Pronto para conectar!'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Toggle Register / Login */}
        <div className="mt-5 text-center text-xs text-slate-400">
          {isRegistering ? (
            <p>
              Já tem uma conta cadastrada?{' '}
              <button
                id="auth-switch-login-btn"
                type="button"
                onClick={() => {
                  setIsRegistering(false);
                  setFormError(null);
                }}
                className="text-[#F27D26] hover:text-[#FF9345] font-semibold underline underline-offset-4 cursor-pointer"
              >
                Fazer login
              </button>
            </p>
          ) : (
            <p>
              Novo por aqui?{' '}
              <button
                id="auth-switch-register-btn"
                type="button"
                onClick={() => {
                  setIsRegistering(true);
                  setFormError(null);
                }}
                className="text-[#F27D26] hover:text-[#FF9345] font-semibold underline underline-offset-4 cursor-pointer"
              >
                Criar uma conta rapidinho
              </button>
            </p>
          )}
        </div>

        {/* Reassuring note */}
        <div className="mt-6 pt-4 border-t border-[#1C1E24] flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <Smile className="w-3.5 h-3.5 text-[#F27D26] shrink-0" />
          <span>Conversas protegidas e sincronizadas em tempo real</span>
        </div>
      </motion.div>
    </div>
  );
};
