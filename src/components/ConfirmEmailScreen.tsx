import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { authService } from '../services/authService';

type ConfirmStatus = 'loading' | 'approved' | 'pending' | 'error';

interface ConfirmEmailScreenProps {
  onGoToLogin?: () => void;
}

export const ConfirmEmailScreen: React.FC<ConfirmEmailScreenProps> = ({ onGoToLogin }) => {
  const [status, setStatus] = useState<ConfirmStatus>('loading');
  const [message, setMessage] = useState<string>('Processando sua solicitação...');

  const handleGoToLogin = () => {
    if (onGoToLogin) {
      onGoToLogin();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const params = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null;
    const token = params?.get('token') || '';
    if (!token) {
      setStatus('error');
      setMessage('Token inválido ou ausente.');
      return;
    }

    const confirm = async () => {
      try {
        const response = await authService.confirmEmail(token);
        const statusResponse = response?.status ?? 'pending_approval';
        setStatus(statusResponse === 'approved' ? 'approved' : 'pending');
        setMessage(response?.message || 'Email confirmado com sucesso.');
      } catch (error) {
        console.error('Erro na confirmação de e-mail:', error);
        const friendly = error instanceof Error
          ? error.message
          : 'Não foi possível confirmar seu e-mail.';
        setStatus('error');
        setMessage(friendly);
      } finally {
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, document.title, '/confirm-email');
        }
      }
    };

    void confirm();
  }, []);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'approved':
        return 'Email confirmado';
      case 'pending':
        return 'Confirmação recebida';
      case 'error':
        return 'Erro na confirmação';
      default:
        return 'Confirmando email';
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{statusLabel}</CardTitle>
          <CardDescription>
            {status === 'approved' && 'Sua conta foi ativada. Você já pode fazer login.'}
            {status === 'pending' && 'Seu cadastro foi confirmado e seguirá para aprovação.'}
            {status === 'loading' && 'Estamos validando o token de confirmação...'}
            {status === 'error' && 'Não foi possível concluir a confirmação.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant={status === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>

          {status === 'loading' && (
            <div className="flex items-center justify-center py-4">
              <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {status !== 'loading' && (
            <Button className="w-full" onClick={handleGoToLogin}>
              Ir para o login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

