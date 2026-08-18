import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FriendsProvider, useFriends } from './context/FriendsContext';
import { ServerProvider, useServer } from './context/ServerContext';
import { VoiceProvider, useVoice } from './context/VoiceContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { AuthView } from './components/auth/AuthView';
import { ServerRail } from './components/servers/ServerRail';
import { ChannelsSidebar } from './components/channels/ChannelsSidebar';
import { ChatArea } from './components/chat/ChatArea';
import { VoiceStage } from './components/voice/VoiceStage';
import { MembersSidebar } from './components/members/MembersSidebar';
import { FriendsView } from './components/friends/FriendsView';
import { CreateServerModal } from './components/modals/CreateServerModal';
import { CreateChannelModal } from './components/modals/CreateChannelModal';
import { InviteModal } from './components/modals/InviteModal';
import { UserSettingsModal } from './components/modals/UserSettingsModal';
import { ServerSettingsModal } from './components/modals/ServerSettingsModal';
import { UserProfileModal } from './components/modals/UserProfileModal';
import { ChannelType } from './types';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const { activeChannel, activeServer, selectServer, selectChannel, servers } = useServer();
  const { activeVoiceChannel } = useVoice();
  const { setHighlightedMessageId } = useNotifications();

  // Navigation State: Friends/DMs vs Server
  const [isFriendsViewActive, setIsFriendsViewActive] = useState<boolean>(false);

  // Modals state
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelTypeToCreate, setChannelTypeToCreate] = useState<ChannelType>('TEXT');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteModalMode, setInviteModalMode] = useState<'INVITE' | 'JOIN'>('INVITE');
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(true);

  const handleNavigateToChannel = async (serverId: string, channelId: string, messageId?: string) => {
    setIsFriendsViewActive(false);
    const targetServer = servers.find((s) => s.id === serverId);
    if (targetServer) {
      await selectServer(targetServer);
      await selectChannel(channelId);
    }
    if (messageId) {
      setHighlightedMessageId(messageId);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0A0A0C] bg-tech-grid flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-2 border-[#F27D26] border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs font-mono font-semibold uppercase tracking-widest text-slate-300">Iniciando Auvix...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  const isVoiceStageActive =
    activeChannel?.type === 'VOICE' ||
    (activeVoiceChannel && activeVoiceChannel.id === activeChannel?.id);

  return (
    <div className="flex h-screen w-screen bg-[#0A0A0C] text-slate-100 overflow-hidden select-none font-sans">
      {/* 1. SERVER NAVIGATION RAIL */}
      <ServerRail
        isFriendsViewActive={isFriendsViewActive}
        onSelectFriendsView={() => setIsFriendsViewActive(true)}
        onSelectServer={() => setIsFriendsViewActive(false)}
        onOpenCreateServer={() => setShowCreateServer(true)}
        onOpenJoinInvite={() => {
          setInviteModalMode('JOIN');
          setShowInviteModal(true);
        }}
      />

      {/* 2. MAIN WORKSPACE */}
      {isFriendsViewActive || !activeServer ? (
        /* FRIENDS & DIRECT MESSAGES VIEW */
        <FriendsView
          onOpenUserSettings={() => setShowUserSettings(true)}
          onNavigateToChannel={handleNavigateToChannel}
        />
      ) : (
        /* ACTIVE SERVER VIEW */
        <>
          {/* CHANNELS & CONTROLS SIDEBAR */}
          <ChannelsSidebar
            onOpenCreateChannel={(type) => {
              setChannelTypeToCreate(type);
              setShowCreateChannel(true);
            }}
            onOpenInvite={() => {
              setInviteModalMode('INVITE');
              setShowInviteModal(true);
            }}
            onOpenUserSettings={() => setShowUserSettings(true)}
            onOpenServerSettings={() => setShowServerSettings(true)}
            onNavigateToChannel={handleNavigateToChannel}
          />

          {/* MAIN CONTENT: TEXT CHAT OR VOICE STAGE */}
          <div className="flex-1 flex h-full min-w-0 overflow-hidden">
            {isVoiceStageActive ? (
              <VoiceStage />
            ) : (
              <ChatArea
                showMembers={showMembers}
                onToggleMembers={() => setShowMembers(!showMembers)}
              />
            )}

            {/* SERVER MEMBERS SIDEBAR (Visible in text channels or toggled) */}
            {!isVoiceStageActive && showMembers && <MembersSidebar />}
          </div>
        </>
      )}

      {/* MODALS */}
      <CreateServerModal
        isOpen={showCreateServer}
        onClose={() => setShowCreateServer(false)}
      />

      <CreateChannelModal
        isOpen={showCreateChannel}
        defaultType={channelTypeToCreate}
        onClose={() => setShowCreateChannel(false)}
      />

      <InviteModal
        isOpen={showInviteModal}
        mode={inviteModalMode}
        onClose={() => setShowInviteModal(false)}
      />

      <UserSettingsModal
        isOpen={showUserSettings}
        onClose={() => setShowUserSettings(false)}
      />

      {activeServer && (
        <ServerSettingsModal
          server={activeServer}
          isOpen={showServerSettings}
          onClose={() => setShowServerSettings(false)}
        />
      )}

      <UserProfileModal />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <FriendsProvider>
          <ServerProvider>
            <VoiceProvider>
              <MainLayout />
            </VoiceProvider>
          </ServerProvider>
        </FriendsProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
