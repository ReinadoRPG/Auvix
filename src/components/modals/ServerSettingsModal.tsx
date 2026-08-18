import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Settings,
  Hash,
  Volume2,
  Shield,
  Users,
  Ban,
  Link,
  Plus,
  Trash2,
  Upload,
  Check,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { Server, Role, Permission, ServerMember, ServerBan, Invite } from '../../types';
import { serverApi, channelApi, inviteApi, uploadApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useServer } from '../../context/ServerContext';

interface ServerSettingsModalProps {
  server: Server;
  isOpen: boolean;
  onClose: () => void;
}

const ALL_PERMISSIONS: { id: Permission; label: string; description: string }[] = [
  { id: 'ADMINISTRATOR', label: 'Administrador', description: 'Garante todas as permissões no servidor e ignora restrições.' },
  { id: 'MANAGE_SERVER', label: 'Gerenciar Servidor', description: 'Permite alterar nome, ícone e configurações do servidor.' },
  { id: 'MANAGE_ROLES', label: 'Gerenciar Cargos', description: 'Permite criar, editar e excluir cargos abaixo do seu.' },
  { id: 'MANAGE_CHANNEL', label: 'Gerenciar Canais', description: 'Permite criar, renomear ou deletar canais de texto e voz.' },
  { id: 'MANAGE_MESSAGES', label: 'Gerenciar Mensagens', description: 'Permite fixar e apagar mensagens de outros membros.' },
  { id: 'KICK_MEMBERS', label: 'Expulsar Membros', description: 'Permite remover membros do servidor.' },
  { id: 'BAN_MEMBERS', label: 'Banir Membros', description: 'Permite banir permanentemente membros do servidor.' },
  { id: 'VIEW_CHANNEL', label: 'Ver Canais', description: 'Permite visualizar e acessar canais do servidor.' },
  { id: 'SEND_MESSAGES', label: 'Enviar Mensagens', description: 'Permite enviar mensagens nos canais de texto.' },
  { id: 'CONNECT', label: 'Conectar na Voz', description: 'Permite entrar em salas de voz e chamadas.' },
  { id: 'SPEAK', label: 'Falar na Voz', description: 'Permite transmitir áudio quando conectado na voz.' },
  { id: 'STREAM', label: 'Compartilhar Tela', description: 'Permite transmitir tela e câmera na chamada.' },
];

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  server,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const { loadServers, deleteServer } = useServer();
  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'roles' | 'members' | 'bans' | 'invites'>('overview');

  // Overview state
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description || '');
  const [iconUrl, setIconUrl] = useState(server.iconUrl || '');
  const [isSavingOverview, setIsSavingOverview] = useState(false);
  const [overviewMsg, setOverviewMsg] = useState<string | null>(null);

  // Channels state
  const [channels, setChannels] = useState(server.channels || []);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'TEXT' | 'VOICE'>('TEXT');

  // Roles state
  const [roles, setRoles] = useState<Role[]>(server.roles || []);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#94a3b8');
  const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);

  // Members state
  const [members, setMembers] = useState<ServerMember[]>(server.members || []);

  // Bans state
  const [bans, setBans] = useState<ServerBan[]>([]);

  // Invites state
  const [invites, setInvites] = useState<Invite[]>([]);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const isOwner = server.ownerId === user?.id;

  useEffect(() => {
    setName(server.name);
    setDescription(server.description || '');
    setIconUrl(server.iconUrl || '');
    setChannels(server.channels || []);
    setRoles(server.roles || []);
    setMembers(server.members || []);

    if (server.roles && server.roles.length > 0 && !selectedRole) {
      handleSelectRole(server.roles[0]);
    }
  }, [server]);

  useEffect(() => {
    if (activeTab === 'bans') {
      fetchBans();
    }
  }, [activeTab]);

  const fetchBans = async () => {
    try {
      const data = await serverApi.getBans(server.id);
      setBans(data.bans || []);
    } catch (err) {
      console.error('Error fetching bans:', err);
    }
  };

  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingOverview(true);
    setOverviewMsg(null);
    try {
      await serverApi.updateServer(server.id, { name, description, iconUrl });
      await loadServers();
      setOverviewMsg('Configurações salvas com sucesso!');
    } catch (err: any) {
      setOverviewMsg(err.message || 'Erro ao salvar servidor.');
    } finally {
      setIsSavingOverview(false);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadApi.uploadFile(file);
      setIconUrl(res.url);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar imagem.');
    }
  };

  const handleDeleteServer = async () => {
    if (!confirm(`Tem certeza que deseja excluir o servidor "${server.name}"? Esta ação é irreversível.`)) return;
    try {
      await deleteServer(server.id);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir servidor.');
    }
  };

  // Channel Actions
  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    try {
      const { channel } = await channelApi.createChannel(server.id, {
        name: newChannelName.trim(),
        type: newChannelType,
      });
      setChannels((prev) => [...prev, channel]);
      await loadServers();
      setNewChannelName('');
    } catch (err: any) {
      alert(err.message || 'Erro ao criar canal.');
    }
  };

  // Role Actions
  const handleSelectRole = (r: Role) => {
    setSelectedRole(r);
    setRoleName(r.name);
    setRoleColor(r.color || '#94a3b8');
    setRolePermissions(r.permissions || []);
  };

  const handleCreateRole = async () => {
    try {
      const { role } = await serverApi.createRole(server.id, {
        name: 'Novo Cargo',
        color: '#94a3b8',
        permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'CONNECT', 'SPEAK'],
      });
      setRoles((prev) => [...prev, role]);
      handleSelectRole(role);
      await loadServers();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar cargo.');
    }
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    try {
      const { role } = await serverApi.updateRole(server.id, selectedRole.id, {
        name: roleName,
        color: roleColor,
        permissions: rolePermissions,
      });
      setRoles((prev) => prev.map((r) => (r.id === role.id ? role : r)));
      setSelectedRole(role);
      await loadServers();
      alert('Cargo salvo com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar cargo.');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Deseja excluir este cargo?')) return;
    try {
      await serverApi.deleteRole(server.id, roleId);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (selectedRole?.id === roleId) {
        setSelectedRole(null);
      }
      await loadServers();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir cargo.');
    }
  };

  const togglePermission = (permId: Permission) => {
    setRolePermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  // Member Role assignment
  const handleAssignRoleToMember = async (userId: string, roleId: string) => {
    try {
      const { member } = await serverApi.assignRole(server.id, userId, roleId);
      setMembers((prev) => prev.map((m) => (m.userId === userId ? member : m)));
      await loadServers();
    } catch (err: any) {
      alert(err.message || 'Erro ao atribuir cargo.');
    }
  };

  const handleRemoveRoleFromMember = async (userId: string, roleId: string) => {
    try {
      const { member } = await serverApi.removeRole(server.id, userId, roleId);
      setMembers((prev) => prev.map((m) => (m.userId === userId ? member : m)));
      await loadServers();
    } catch (err: any) {
      alert(err.message || 'Erro ao remover cargo.');
    }
  };

  const handleKickMember = async (userId: string) => {
    if (!confirm('Deseja expulsar este membro?')) return;
    try {
      await serverApi.kickMember(server.id, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      await loadServers();
    } catch (err: any) {
      alert(err.message || 'Erro ao expulsar membro.');
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      await serverApi.unbanMember(server.id, userId);
      setBans((prev) => prev.filter((b) => b.userId !== userId));
    } catch (err: any) {
      alert(err.message || 'Erro ao desbanir.');
    }
  };

  const handleCreateInvite = async () => {
    try {
      const { invite } = await inviteApi.createInvite(server.id, 0, 24);
      setInvites((prev) => [invite, ...prev]);
      setCreatedInviteCode(invite.code);
    } catch (err: any) {
      alert(err.message || 'Erro ao gerar convite.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="server-settings-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          id="server-settings-card"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-4xl h-[650px] bg-[#101217] border border-[#242934] rounded-xl shadow-2xl overflow-hidden flex text-zinc-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sidebar Tabs */}
          <div className="w-56 bg-[#0c0e12] border-r border-[#202530] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 px-3 py-2 mb-4 border-b border-[#1e232d]">
                <Settings className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 truncate">
                  {server.name}
                </span>
              </div>

              <nav className="space-y-1">
                <button
                  id="tab-overview"
                  onClick={() => setActiveTab('overview')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'overview'
                      ? 'bg-[#222733] text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151921]'
                  }`}
                >
                  <Settings className="w-4 h-4 text-zinc-400" />
                  <span>Visão Geral</span>
                </button>

                <button
                  id="tab-roles"
                  onClick={() => setActiveTab('roles')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'roles'
                      ? 'bg-[#222733] text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151921]'
                  }`}
                >
                  <Shield className="w-4 h-4 text-zinc-400" />
                  <span>Cargos e Permissões</span>
                </button>

                <button
                  id="tab-members"
                  onClick={() => setActiveTab('members')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'members'
                      ? 'bg-[#222733] text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151921]'
                  }`}
                >
                  <Users className="w-4 h-4 text-zinc-400" />
                  <span>Membros ({members.length})</span>
                </button>

                <button
                  id="tab-bans"
                  onClick={() => setActiveTab('bans')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'bans'
                      ? 'bg-[#222733] text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151921]'
                  }`}
                >
                  <Ban className="w-4 h-4 text-zinc-400" />
                  <span>Banimentos</span>
                </button>
              </nav>
            </div>

            {isOwner && (
              <button
                id="btn-delete-server"
                onClick={handleDeleteServer}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 border border-rose-900/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Servidor</span>
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#101217]">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#202530]">
              <h2 className="text-base font-bold text-white">
                {activeTab === 'overview' && 'Visão Geral do Servidor'}
                {activeTab === 'roles' && 'Gerenciamento de Cargos'}
                {activeTab === 'members' && 'Membros do Servidor'}
                {activeTab === 'bans' && 'Usuários Banidos'}
              </h2>
              <button
                id="btn-close-settings"
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-[#1c202a] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* VISÃO GERAL */}
              {activeTab === 'overview' && (
                <form onSubmit={handleSaveOverview} className="max-w-xl space-y-6">
                  {overviewMsg && (
                    <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-200 text-xs">
                      {overviewMsg}
                    </div>
                  )}

                  {/* Icon Upload & Preview */}
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <img
                        src={iconUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`}
                        alt={name}
                        className="w-20 h-20 rounded-2xl bg-[#181b22] border-2 border-[#2b3240] object-cover"
                      />
                      <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                        <Upload className="w-5 h-5 text-white" />
                        <input type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
                      </label>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Ícone do Servidor</h4>
                      <p className="text-xs text-zinc-400 mb-2">Recomendado tamanho mínimo de 128x128px</p>
                      <label className="px-3 py-1.5 rounded-lg bg-[#202532] hover:bg-[#2a3140] text-zinc-300 text-xs font-medium cursor-pointer border border-[#303848] transition-colors">
                        Enviar Imagem
                        <input type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
                      </label>
                    </div>
                  </div>

                  {/* Server Name */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Nome do Servidor
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-[#0c0e12] border border-[#242934] text-sm text-zinc-200 focus:outline-none focus:border-[#F27D26]"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Descrição do Servidor
                    </label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Conte um pouco sobre esta comunidade..."
                      className="w-full px-3 py-2 rounded-lg bg-[#0c0e12] border border-[#242934] text-sm text-zinc-200 focus:outline-none focus:border-[#F27D26]"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSavingOverview}
                      className="px-5 py-2 rounded-lg bg-[#F27D26] hover:bg-[#e06d19] text-white text-xs font-medium shadow-sm transition-colors"
                    >
                      {isSavingOverview ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </form>
              )}

              {/* ROLES & PERMISSIONS */}
              {activeTab === 'roles' && (
                <div className="flex h-full gap-6">
                  {/* Roles list */}
                  <div className="w-52 border-r border-[#202530] pr-4 space-y-2">
                    <button
                      onClick={handleCreateRole}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#F27D26] hover:bg-[#e06d19] text-white text-xs font-medium transition-colors mb-3"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Novo Cargo</span>
                    </button>

                    <div className="space-y-1 overflow-y-auto max-h-[440px]">
                      {roles.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => handleSelectRole(r)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                            selectedRole?.id === r.id
                              ? 'bg-[#202634] text-white border border-[#303848]'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141820]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: r.color || '#94a3b8' }}
                            />
                            <span className="truncate">{r.name}</span>
                          </div>
                          {r.name === 'Owner' && (
                            <span className="text-[10px] bg-amber-950/60 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800/40">
                              Dono
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Role editor */}
                  {selectedRole ? (
                    <div className="flex-1 space-y-5 overflow-y-auto pr-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white">Editar Cargo: {selectedRole.name}</h3>
                          <p className="text-xs text-zinc-400">Configure o nome, cor e permissões atribuídas a este cargo</p>
                        </div>
                        {selectedRole.name !== 'Owner' && selectedRole.name !== 'Member' && (
                          <button
                            onClick={() => handleDeleteRole(selectedRole.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 border border-rose-900/40 text-xs flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        )}
                      </div>

                      {/* Name & Color */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                            Nome do Cargo
                          </label>
                          <input
                            type="text"
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-[#0c0e12] border border-[#242934] text-xs text-zinc-200 focus:outline-none focus:border-[#F27D26]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                            Cor do Cargo
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={roleColor}
                              onChange={(e) => setRoleColor(e.target.value)}
                              className="w-9 h-8 rounded bg-transparent cursor-pointer border-0"
                            />
                            <input
                              type="text"
                              value={roleColor}
                              onChange={(e) => setRoleColor(e.target.value)}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-[#0c0e12] border border-[#242934] text-xs text-zinc-200 focus:outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Permissions List */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                          Permissões do Cargo
                        </h4>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {ALL_PERMISSIONS.map((perm) => {
                            const isChecked = rolePermissions.includes(perm.id);
                            return (
                              <div
                                key={perm.id}
                                onClick={() => togglePermission(perm.id)}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-[#181e2a] border-[#2e3b52]'
                                    : 'bg-[#0e1015] border-[#1e232d] hover:bg-[#141720]'
                                }`}
                              >
                                <div>
                                  <div className="text-xs font-semibold text-zinc-200">{perm.label}</div>
                                  <div className="text-[11px] text-zinc-500">{perm.description}</div>
                                </div>
                                <div
                                  className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                    isChecked
                                      ? 'bg-[#F27D26] border-[#F27D26] text-white'
                                      : 'border-zinc-700 bg-zinc-900'
                                  }`}
                                >
                                  {isChecked && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={handleSaveRole}
                          className="px-4 py-2 rounded-lg bg-[#F27D26] hover:bg-[#e06d19] text-white text-xs font-medium transition-colors"
                        >
                          Salvar Cargo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
                      Selecione um cargo para visualizar e editar suas permissões
                    </div>
                  )}
                </div>
              )}

              {/* MEMBERS */}
              {activeTab === 'members' && (
                <div className="space-y-4">
                  <div className="text-xs text-zinc-400">
                    Gerencie os membros do servidor, atribua cargos personalizados ou remova participantes.
                  </div>

                  <div className="space-y-2 max-h-[460px] overflow-y-auto">
                    {members.map((m) => {
                      const isOwnerMember = m.userId === server.ownerId;
                      const memberRoles = m.roles || [];

                      return (
                        <div
                          key={m.userId}
                          className="flex items-center justify-between p-3 rounded-lg bg-[#141720] border border-[#222734]"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={m.user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.user.username}`}
                              alt={m.user.displayName || m.user.username}
                              className="w-9 h-9 rounded-full bg-[#1e232e] object-cover"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-zinc-200">
                                  {m.user.displayName || m.user.username}
                                </span>
                                <span className="text-[11px] font-mono text-zinc-500">
                                  @{m.user.username}
                                </span>
                                {isOwnerMember && (
                                  <span className="text-[10px] bg-amber-950/60 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800/40">
                                    Dono
                                  </span>
                                )}
                              </div>

                              {/* Roles list */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {memberRoles.map((r) => (
                                  <span
                                    key={r.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#1c2230] border border-[#2c374c]"
                                    style={{ color: r.color || '#94a3b8' }}
                                  >
                                    {r.name}
                                    {!isOwnerMember && (
                                      <button
                                        onClick={() => handleRemoveRoleFromMember(m.userId, r.id)}
                                        className="hover:text-rose-400 ml-0.5"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Member actions */}
                          {!isOwnerMember && (
                            <div className="flex items-center gap-2">
                              {/* Assign role dropdown */}
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignRoleToMember(m.userId, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                defaultValue=""
                                className="px-2 py-1 rounded bg-[#0c0e12] border border-[#242934] text-xs text-zinc-300 focus:outline-none"
                              >
                                <option value="" disabled>
                                  + Atribuir Cargo
                                </option>
                                {roles
                                  .filter((r) => !memberRoles.some((mr) => mr.id === r.id))
                                  .map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name}
                                    </option>
                                  ))}
                              </select>

                              {isOwner && (
                                <button
                                  onClick={() => handleKickMember(m.userId)}
                                  className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs transition-colors"
                                >
                                  Expulsar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BANS */}
              {activeTab === 'bans' && (
                <div className="space-y-4">
                  <div className="text-xs text-zinc-400">
                    Lista de usuários banidos permanentemente deste servidor.
                  </div>

                  {bans.length === 0 ? (
                    <div className="text-center py-12 text-xs text-zinc-500">
                      Nenhum usuário banido no momento.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[460px] overflow-y-auto">
                      {bans.map((ban) => (
                        <div
                          key={ban.userId}
                          className="flex items-center justify-between p-3 rounded-lg bg-[#141720] border border-[#222734]"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={ban.user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${ban.user.username}`}
                              alt={ban.user.username}
                              className="w-9 h-9 rounded-full bg-[#1e232e] object-cover"
                            />
                            <div>
                              <div className="text-xs font-semibold text-zinc-200">
                                {ban.user.displayName || ban.user.username} (@{ban.user.username})
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                Motivo: {ban.reason || 'Nenhum motivo especificado'}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleUnban(ban.userId)}
                            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
                          >
                            Desbanir
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
