import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { apiService } from '../services/apiService';
import type { SystemSettings } from '../types';

export function ConfiguracoesView() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [deadlines, setDeadlines] = useState({
    singularToFederacao: '30',
    federacaoToConfederacao: '30',
  });
  const [requireApproval, setRequireApproval] = useState(true);
  const [autoNotifyManagers, setAutoNotifyManagers] = useState(true);
  const [enableSelfRegistration, setEnableSelfRegistration] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const settings = await apiService.getSystemSettings();
        if (settings) {
          setTheme(settings.theme);
          setDeadlines({
            singularToFederacao: settings.deadlines.singularToFederacao.toString(),
            federacaoToConfederacao: settings.deadlines.federacaoToConfederacao.toString(),
          });
          setRequireApproval(settings.requireApproval);
          setAutoNotifyManagers(settings.autoNotifyManagers);
          setEnableSelfRegistration(settings.enableSelfRegistration);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        setStatus({ type: 'error', message: 'Não foi possível carregar as configurações atuais.' });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setStatus(null);
      const payload: SystemSettings = {
        theme,
        deadlines: {
          singularToFederacao: Math.max(1, Number(deadlines.singularToFederacao) || 1),
          federacaoToConfederacao: Math.max(1, Number(deadlines.federacaoToConfederacao) || 1),
        },
        requireApproval,
        autoNotifyManagers,
        enableSelfRegistration,
      };
      const saved = await apiService.updateSystemSettings(payload);
      setTheme(saved.theme);
      setDeadlines({
        singularToFederacao: saved.deadlines.singularToFederacao.toString(),
        federacaoToConfederacao: saved.deadlines.federacaoToConfederacao.toString(),
      });
      setRequireApproval(saved.requireApproval);
      setAutoNotifyManagers(saved.autoNotifyManagers);
      setEnableSelfRegistration(saved.enableSelfRegistration);
      setStatus({ type: 'success', message: 'Preferências salvas com sucesso.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar as preferências';
      setStatus({ type: 'error', message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Configurações do sistema</h1>
        <p className="text-gray-600 dark:text-slate-400">Carregando preferências atuais...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Configurações do sistema</h1>
        <p className="text-gray-600">Ajuste o comportamento global da plataforma para todos os usuários.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tema da interface</CardTitle>
          <CardDescription>Escolha o tema padrão exibido ao acessar o sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { id: 'light', label: 'Claro', description: 'Ideal para ambientes bem iluminados.' },
              { id: 'dark', label: 'Escuro', description: 'Reduz o cansaço visual em ambientes com pouca luz.' },
              { id: 'system', label: 'Automático', description: 'Segue a preferência configurada no dispositivo.' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id as typeof theme)}
                className={`rounded-lg border p-4 text-left transition ${
                  theme === option.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <span className="font-semibold text-gray-900">{option.label}</span>
                <p className="text-sm text-gray-500">{option.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fluxo de aprovação</CardTitle>
          <CardDescription>Configure prazos e regras para movimentação entre níveis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="prazo-singular">
                Singular → Federação (dias)
              </label>
              <Input
                id="prazo-singular"
                value={deadlines.singularToFederacao}
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(event) => setDeadlines((prev) => ({ ...prev, singularToFederacao: event.target.value }))}
                disabled={isLoading || isSaving}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="prazo-federacao">
                Federação → Confederação (dias)
              </label>
              <Input
                id="prazo-federacao"
                value={deadlines.federacaoToConfederacao}
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(event) => setDeadlines((prev) => ({ ...prev, federacaoToConfederacao: event.target.value }))}
                disabled={isLoading || isSaving}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={requireApproval}
                onChange={(event) => setRequireApproval(event.target.checked)}
                disabled={isLoading || isSaving}
              />
              Exigir aprovação manual antes de liberar novos usuários
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={autoNotifyManagers}
                onChange={(event) => setAutoNotifyManagers(event.target.checked)}
                disabled={isLoading || isSaving}
              />
              Notificar automaticamente os responsáveis quando houver solicitações pendentes
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={enableSelfRegistration}
                onChange={(event) => setEnableSelfRegistration(event.target.checked)}
                disabled={isLoading || isSaving}
              />
              Permitir que novos usuários criem conta antes da aprovação
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        {status && (
          <p className={`text-sm ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {status.message}
          </p>
        )}
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? 'Salvando...' : 'Salvar preferências'}
        </Button>
      </div>
    </div>
  );
}
