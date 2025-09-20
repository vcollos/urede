import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Building2, ShieldCheck, UserCircle2 } from 'lucide-react';

const roleLabel: Record<string, string> = {
  confederacao: 'Confederação',
  federacao: 'Federação',
  admin: 'Administrador',
  operador: 'Operador',
};

const roleBadgeClass: Record<string, string> = {
  confederacao: 'bg-red-100 text-red-800 border-red-200',
  federacao: 'bg-blue-100 text-blue-800 border-blue-200',
  admin: 'bg-purple-100 text-purple-800 border-purple-200',
  operador: 'bg-green-100 text-green-800 border-green-200',
};

const roleIcon: Record<string, JSX.Element> = {
  confederacao: <ShieldCheck className="w-4 h-4" />,
  federacao: <ShieldCheck className="w-4 h-4" />,
  admin: <ShieldCheck className="w-4 h-4" />,
  operador: <UserCircle2 className="w-4 h-4" />,
};

const initialProfileState = {
  nome: '',
  display_name: '',
  cargo: '',
  telefone: '',
  whatsapp: '',
};

const initialPasswordState = {
  current_password: '',
  new_password: '',
  confirm_password: '',
};

export function ConfiguracoesView() {
  const { user, updateProfile, changePassword } = useAuth();
  const [profileForm, setProfileForm] = useState(initialProfileState);
  const [passwordForm, setPasswordForm] = useState(initialPasswordState);
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      nome: user.nome || '',
      display_name: user.display_name || user.nome || '',
      cargo: user.cargo || '',
      telefone: user.telefone || '',
      whatsapp: user.whatsapp || '',
    });
  }, [user]);

  const papel = useMemo(() => user?.papel ?? 'operador', [user?.papel]);
  const papelLabel = roleLabel[papel] ?? papel;

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setIsSavingProfile(true);
    setProfileStatus(null);

    try {
      const payload: Record<string, string> = {};
      (Object.keys(profileForm) as Array<keyof typeof profileForm>).forEach((key) => {
        const value = profileForm[key]?.trim();
        const current = user[key as keyof User];
        if (value !== undefined && value !== null && value !== current) {
          payload[key] = value;
        }
      });

      if (Object.keys(payload).length === 0) {
        setProfileStatus({ type: 'success', message: 'Nenhuma alteração detectada.' });
        return;
      }

      const updated = await updateProfile(payload);
      if (updated) {
        setProfileStatus({ type: 'success', message: 'Perfil atualizado com sucesso.' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
      setProfileStatus({ type: 'error', message });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordForm.new_password.trim()) {
      setPasswordStatus({ type: 'error', message: 'Informe a nova senha.' });
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordStatus({ type: 'error', message: 'A confirmação não corresponde à nova senha.' });
      return;
    }

    setIsSavingPassword(true);
    setPasswordStatus(null);

    try {
      await changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordStatus({ type: 'success', message: 'Senha atualizada com sucesso.' });
      setPasswordForm(initialPasswordState);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar senha';
      setPasswordStatus({ type: 'error', message });
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600">Gerencie seus dados pessoais e preferências de acesso.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle2 className="w-5 h-5 text-blue-600" />
            Seu Perfil
          </CardTitle>
          <CardDescription>
            Revise seus dados e mantenha o cadastro sempre atualizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <Badge variant="outline" className={`flex items-center gap-2 ${roleBadgeClass[papel] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
              {roleIcon[papel]}
              {papelLabel}
            </Badge>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span>Cooperativa: {user.cooperativa_id || '—'}</span>
            </div>
            <span>|</span>
            <span>Email: {user.email}</span>
          </div>

          <Separator />

          <form className="space-y-4" onSubmit={handleProfileSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="perfil-nome">Nome completo</Label>
                <Input
                  id="perfil-nome"
                  value={profileForm.nome}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, nome: event.target.value }))}
                  placeholder="Insira seu nome"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-display-name">Como deve aparecer</Label>
                <Input
                  id="perfil-display-name"
                  value={profileForm.display_name}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, display_name: event.target.value }))}
                  placeholder="Nome de exibição"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-cargo">Cargo</Label>
                <Input
                  id="perfil-cargo"
                  value={profileForm.cargo}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, cargo: event.target.value }))}
                  placeholder="Função na cooperativa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-telefone">Telefone</Label>
                <Input
                  id="perfil-telefone"
                  value={profileForm.telefone}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, telefone: event.target.value }))}
                  placeholder="(00) 0000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-whatsapp">WhatsApp</Label>
                <Input
                  id="perfil-whatsapp"
                  value={profileForm.whatsapp}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, whatsapp: event.target.value }))}
                  placeholder="(00) 90000-0000"
                />
              </div>
            </div>

            {profileStatus && (
              <p className={`text-sm ${profileStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {profileStatus.message}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
          <CardDescription>Atualize sua senha periodicamente para manter a conta protegida.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handlePasswordSubmit}>
            <div className="space-y-2">
              <Label htmlFor="senha-atual">Senha atual</Label>
              <Input
                id="senha-atual"
                type="password"
                value={passwordForm.current_password}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, current_password: event.target.value }))}
                placeholder="Informe sua senha atual"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nova-senha">Nova senha</Label>
                <Input
                  id="nova-senha"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }))}
                  placeholder="Mínimo de 8 caracteres"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                <Input
                  id="confirmar-senha"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }))}
                  placeholder="Repita a nova senha"
                  required
                />
              </div>
            </div>

            {passwordStatus && (
              <p className={`text-sm ${passwordStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {passwordStatus.message}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={isSavingPassword}>
                {isSavingPassword ? 'Atualizando...' : 'Atualizar senha'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
