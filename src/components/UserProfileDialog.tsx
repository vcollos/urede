import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Building2, ShieldCheck, UserCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../types';
import { cn } from './ui/utils';

const roleLabel: Record<string, string> = {
  confederacao: 'Confederação',
  federacao: 'Federação',
  admin: 'Administrador',
  operador: 'Responsável',
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

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
  const { user, updateProfile, changePassword } = useAuth();
  const [profileForm, setProfileForm] = useState(initialProfileState);
  const [passwordForm, setPasswordForm] = useState(initialPasswordState);
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    setProfileForm({
      nome: user.nome || '',
      display_name: user.display_name || user.nome || '',
      cargo: user.cargo || '',
      telefone: user.telefone || '',
      whatsapp: user.whatsapp || '',
    });
    setPasswordForm(initialPasswordState);
    setProfileStatus(null);
    setPasswordStatus(null);
  }, [user, open]);

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

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Perfil do usuário</DialogTitle>
          <DialogDescription>Atualize seus dados pessoais, preferências e senha de acesso.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <Badge variant="outline" className={cn('flex items-center gap-2', roleBadgeClass[papel] ?? 'bg-gray-100 text-gray-700 border-gray-200')}>
              {roleIcon[papel]}
              {papelLabel}
            </Badge>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span>Cooperativa: {user.cooperativa_id || '—'}</span>
            </div>
            <span>•</span>
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
                <Label htmlFor="perfil-display-name">Nome de exibição</Label>
                <Input
                  id="perfil-display-name"
                  value={profileForm.display_name}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, display_name: event.target.value }))}
                  placeholder="Como deve aparecer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-cargo">Cargo</Label>
                <Input
                  id="perfil-cargo"
                  value={profileForm.cargo}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, cargo: event.target.value }))}
                  placeholder="Cargo/Função"
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
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {profileStatus && (
              <p className={cn('text-sm', profileStatus.type === 'success' ? 'text-green-600' : 'text-red-600')}>
                {profileStatus.message}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </DialogFooter>
          </form>

          <Separator />

          <form className="space-y-4" onSubmit={handlePasswordSubmit}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="perfil-senha-atual">Senha atual</Label>
                <Input
                  id="perfil-senha-atual"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, current_password: event.target.value }))}
                  placeholder="Digite sua senha atual"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-senha-nova">Nova senha</Label>
                <Input
                  id="perfil-senha-nova"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }))}
                  placeholder="Crie uma senha segura"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-senha-confirmacao">Confirmar nova senha</Label>
                <Input
                  id="perfil-senha-confirmacao"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }))}
                  placeholder="Repita a nova senha"
                  required
                />
              </div>
            </div>

            {passwordStatus && (
              <p className={cn('text-sm', passwordStatus.type === 'success' ? 'text-green-600' : 'text-red-600')}>
                {passwordStatus.message}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? 'Atualizando...' : 'Atualizar senha'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
