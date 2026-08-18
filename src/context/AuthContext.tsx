import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, UserStatus } from '../types';
import { authApi, apiClient } from '../services/api';
import { socketService } from '../services/socket';
import {
  auth,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
  syncUserToFirestore,
} from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (username: string, email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: {
    displayName?: string;
    username?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    customStatus?: string;
    bio?: string;
    status?: UserStatus;
  }) => Promise<void>;
  setPresence: (status: UserStatus, customStatus?: string) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isSyncingFirebaseRef = useRef<boolean>(false);

  // Revalidate traditional JWT session if no active Firebase session was caught
  const revalidateTokenAuth = useCallback(async () => {
    const token = apiClient.getAccessToken();
    const refreshToken = apiClient.getRefreshToken();

    if (!token && !refreshToken) {
      apiClient.clearTokens();
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const { user: me } = await authApi.fetchMe();
      setUser(me);
      apiClient.setCachedUser(me);
      const activeToken = apiClient.getAccessToken() || token;
      if (activeToken) {
        socketService.connect(activeToken);
      }
      syncUserToFirestore(me).catch(console.warn);
    } catch (err: any) {
      console.warn('Session revalidation failed:', err);
      apiClient.clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Use Firebase onAuthStateChanged as the primary listener for authentication persistence
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (isSyncingFirebaseRef.current) return;
        isSyncingFirebaseRef.current = true;
        try {
          if (!firebaseUser.email) {
            throw new Error('Conta do Firebase sem email.');
          }

          const data = await authApi.firebaseGoogleLogin({
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoUrl: firebaseUser.photoURL,
            firebaseUid: firebaseUser.uid,
          });

          apiClient.setTokens(data.accessToken, data.refreshToken);
          apiClient.setCachedUser(data.user);
          setUser(data.user);
          socketService.connect(data.accessToken);
          syncUserToFirestore(data.user, firebaseUser).catch(console.warn);
        } catch (err) {
          console.warn('Firebase session restore error, fallback to token check:', err);
          await revalidateTokenAuth();
        } finally {
          isSyncingFirebaseRef.current = false;
          setLoading(false);
        }
      } else {
        // No Firebase user logged in, check if user has a traditional email/password JWT session
        await revalidateTokenAuth();
      }
    });

    const handleAuthExpired = () => {
      setUser(null);
      apiClient.clearTokens();
      socketService.disconnect();
      try {
        fbSignOut(auth);
      } catch {}
    };

    window.addEventListener('auvix:auth-expired', handleAuthExpired);

    return () => {
      unsubscribe();
      window.removeEventListener('auvix:auth-expired', handleAuthExpired);
    };
  }, [revalidateTokenAuth]);

  // Real-time socket presence listeners for the active authenticated user
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !user) return;

    const handlePresenceInit = (data: { userId: string; presenceStatus?: UserStatus; status?: UserStatus; customStatus?: string }) => {
      if (data.userId === user.id) {
        setUser((prev) => {
          if (!prev) return null;
          const chosen = data.presenceStatus || data.status || prev.presenceStatus || prev.status;
          const updated = {
            ...prev,
            presenceStatus: chosen as any,
            status: chosen as any,
            customStatus: data.customStatus ?? prev.customStatus,
          };
          apiClient.setCachedUser(updated);
          return updated;
        });
      }
    };

    const handlePresenceUpdated = (data: { userId: string; presenceStatus?: UserStatus; status?: UserStatus; customStatus?: string }) => {
      if (data.userId === user.id) {
        setUser((prev) => {
          if (!prev) return null;
          const chosen = data.presenceStatus || data.status || prev.presenceStatus || prev.status;
          const updated = {
            ...prev,
            presenceStatus: chosen as any,
            status: chosen as any,
            customStatus: data.customStatus ?? prev.customStatus,
          };
          apiClient.setCachedUser(updated);
          return updated;
        });
      }
    };

    socket.on('presence-init', handlePresenceInit);
    socket.on('presence-updated', handlePresenceUpdated);

    return () => {
      socket.off('presence-init', handlePresenceInit);
      socket.off('presence-updated', handlePresenceUpdated);
    };
  }, [user?.id]);

  const login = async (identifier: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.login({ identifier, password });
      apiClient.setTokens(data.accessToken, data.refreshToken);
      apiClient.setCachedUser(data.user);
      setUser(data.user);
      socketService.connect(data.accessToken);
      syncUserToFirestore(data.user).catch(console.warn);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      if (!fbUser.email) {
        throw new Error('A conta do Google não forneceu um endereço de e-mail.');
      }

      const data = await authApi.firebaseGoogleLogin({
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoUrl: fbUser.photoURL,
        firebaseUid: fbUser.uid,
      });

      apiClient.setTokens(data.accessToken, data.refreshToken);
      apiClient.setCachedUser(data.user);
      setUser(data.user);
      socketService.connect(data.accessToken);
      syncUserToFirestore(data.user, fbUser).catch(console.warn);
    } catch (err: any) {
      console.error('Firebase Google sign-in failed:', err);
      const msg =
        err?.code === 'auth/popup-closed-by-user'
          ? 'Login cancelado.'
          : err.message || 'Falha ao autenticar com o Google.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string, displayName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.register({ username, email, password, displayName });
      apiClient.setTokens(data.accessToken, data.refreshToken);
      apiClient.setCachedUser(data.user);
      setUser(data.user);
      socketService.connect(data.accessToken);
      syncUserToFirestore(data.user).catch(console.warn);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      try {
        await fbSignOut(auth);
      } catch {}
      apiClient.clearTokens();
      socketService.disconnect();
      setUser(null);
    }
  };

  const updateProfile = async (data: {
    displayName?: string;
    username?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    customStatus?: string;
    bio?: string;
    status?: UserStatus;
  }) => {
    try {
      const { user: updated } = await authApi.updateProfile(data);
      setUser(updated);
      apiClient.setCachedUser(updated);
      if (data.status || data.customStatus !== undefined) {
        socketService.setPresence(data.status || updated.status, data.customStatus ?? updated.customStatus);
      }
      syncUserToFirestore(updated).catch(console.warn);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar perfil.');
      throw err;
    }
  };

  const setPresence = (status: UserStatus, customStatus?: string) => {
    const normalized = status === 'DND' ? 'DO_NOT_DISTURB' : status;
    if (user) {
      const updatedUser: User = {
        ...user,
        presenceStatus: normalized as any,
        status: normalized as any,
        customStatus: customStatus !== undefined ? customStatus : user.customStatus,
      };
      setUser(updatedUser);
      apiClient.setCachedUser(updatedUser);
      socketService.setPresence(normalized as UserStatus, customStatus);
      syncUserToFirestore(updatedUser).catch(console.warn);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        loginWithGoogle,
        register,
        logout,
        updateProfile,
        setPresence,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
