import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { apiService } from '../services/apiService';
import type { SystemSettings, CooperativaConfig } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function ConfiguracoesView() {
  const { user } = useAuth();
  const isConfederacao = user?.papel === 'confederacao';
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [deadlines, setDeadlines] = useState({
    singularToFederacao: '30',
    federacaoToConfederacao: '30',
  });
  const [requireApproval, setRequireApproval] = useState(true);
  const [autoNotifyManagers, setAutoNotifyManagers] = useState(true);
  const [enableSelfRegistration, setEnableSelfRegistration] = useState(true);
  const [pedidoMotivos, setPedidoMotivos] = useState<string[]>([]);
  const [novoMotivo, setNovoMotivo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [cooperativaConfig, setCooperativaConfig] = useState<CooperativaConfig | null>(null);
  const [isLoadingCoopConfig, setIsLoadingCoopConfig] = useState(false);
  const [isSavingCoopConfig, setIsSavingCoopConfig] = useState(false);
  const [coopStatus, setCoopStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canManageSystem = isConfederacao;
  const canManageCooperativa = Boolean(
    user && user.cooperativa_id && !isConfederacao && (user.papel === 'admin' || user.papel === 'federacao')
  );

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
          setPedidoMotivos(settings.pedido_motivos ?? []);
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

  useEffect(() => {
    if (!canManageCooperativa || !user?.cooperativa_id) {
      setCooperativaConfig(null);
      return;
    }

    let active = true;
    const run = async () => {
      try {
        setIsLoadingCoopConfig(true);
        const config = await apiService.getCooperativaConfig(user.cooperativa_id);
        if (active) {
          setCooperativaConfig(config);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações da cooperativa:', error);
        if (active) {
          setCoopStatus({ type: 'error', message: 'Não foi possível carregar as preferências da cooperativa.' });
        }
      } finally {
        if (active) {
          setIsLoadingCoopConfig(false);
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [canManageCooperativa, user?.cooperativa_id]);

  const handleAddMotivo = () => {
    const trimmed = novoMotivo.trim();
    if (!trimmed) return;
    const exists = pedidoMotivos.some(
      (motivo) => motivo.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setNovoMotivo('');
      return;
    }
    setPedidoMotivos((prev) => [...prev, trimmed]);
    setNovoMotivo('');
  };

  const handleRemoveMotivo = (motivo: string) => {
    setPedidoMotivos((prev) => prev.filter((item) => item !== motivo));
  };

  const handleSave = async () => {
    if (!canManageSystem) return;
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
        pedido_motivos: pedidoMotivos,
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
      setPedidoMotivos(saved.pedido_motivos ?? []);
      setStatus({ type: 'success', message: 'Preferências salvas com sucesso.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar as preferências';
      setStatus({ type: 'error', message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAutoRecusar = async (value: boolean) => {
    if (!canManageCooperativa || !user?.cooperativa_id || isSavingCoopConfig) return;
    try {
      setIsSavingCoopConfig(true);
      setCoopStatus(null);
      const updated = await apiService.updateCooperativaConfig(user.cooperativa_id, { auto_recusar: value });
      setCooperativaConfig(updated);
      setCoopStatus({
        type: 'success',
        message: value
          ? 'Pedidos serão transferidos automaticamente para o próximo nível.'
          : 'A cooperativa voltará a receber pedidos normalmente.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar a preferência';
      setCoopStatus({ type: 'error', message });
    } finally {
      setIsSavingCoopConfig(false);
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

      {canManageSystem ? (
        <>
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
                    disabled={!canManageSystem || isLoading || isSaving}
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
                    disabled={!canManageSystem || isLoading || isSaving}
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
                    disabled={!canManageSystem || isLoading || isSaving}
                  />
                  Exigir aprovação manual antes de liberar novos usuários
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={autoNotifyManagers}
                    onChange={(event) => setAutoNotifyManagers(event.target.checked)}
                    disabled={!canManageSystem || isLoading || isSaving}
                  />
                  Notificar automaticamente os responsáveis quando houver solicitações pendentes
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={enableSelfRegistration}
                    onChange={(event) => setEnableSelfRegistration(event.target.checked)}
                    disabled={!canManageSystem || isLoading || isSaving}
                  />
                  Permitir que novos usuários criem conta antes da aprovação
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categorias de pedidos</CardTitle>
              <CardDescription>Defina os motivos exibidos ao solicitar um novo credenciamento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={novoMotivo}
                  onChange={(event) => setNovoMotivo(event.target.value)}
                  placeholder="Adicionar nova categoria"
                  className="flex-1"
                  disabled={isSaving}
                />
                <Button
                  type="button"
                  onClick={handleAddMotivo}
                  disabled={isSaving || !novoMotivo.trim()}
                >
                  Adicionar
                </Button>
              </div>
              {pedidoMotivos.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Nenhuma categoria cadastrada. Inclua aqui os motivos que os solicitantes poderão escolher.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pedidoMotivos.map((motivo) => (
                    <Badge key={motivo} variant="secondary" className="flex items-center gap-2">
                      {motivo}
                      <button
                        type="button"
                        className="text-xs text-gray-500 hover:text-red-600"
                        onClick={() => handleRemoveMotivo(motivo)}
                        disabled={isSaving}
                        aria-label={`Remover categoria ${motivo}`}
                      >
                        remover
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500">
                Alterações nesta lista ficam disponíveis imediatamente para os solicitantes ao criar um pedido.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Configurações do fluxo de aprovação</CardTitle>
            <CardDescription>Disponível apenas para a Confederação.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Entre em contato com a Confederação para ajustar prazos e regras de aprovação.
            </p>
          </CardContent>
        </Card>
      )}

      {canManageCooperativa && cooperativaConfig && cooperativaConfig.tipo !== 'CONFEDERACAO' && (
        <Card>
          <CardHeader>
            <CardTitle>Preferências da cooperativa</CardTitle>
            <CardDescription>
              Controle como a sua cooperativa responde às solicitações recebidas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={cooperativaConfig.auto_recusar}
                  onChange={(event) => handleToggleAutoRecusar(event.target.checked)}
                  disabled={isLoadingCoopConfig || isSavingCoopConfig}
                />
                <div>
                  <p className="font-medium text-gray-900">Recusar pedidos automaticamente</p>
                  <p className="text-sm text-gray-600">
                    Quando ativado, qualquer pedido direcionado para {cooperativaConfig.nome} será transferido
                    imediatamente para o próximo nível hierárquico.
                  </p>
                </div>
              </label>
              {isSavingCoopConfig && (
                <p className="mt-3 text-sm text-gray-500">Aplicando preferência...</p>
              )}
              {coopStatus && (
                <p className={`mt-3 text-sm ${coopStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {coopStatus.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {user?.papel === 'confederacao' && (
        <Card>
          <CardHeader>
            <CardTitle>Preferências da cooperativa</CardTitle>
            <CardDescription>A Confederação recebe escalonamentos automaticamente e não pode recusar pedidos.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Você já está no nível máximo da hierarquia. Transferências automáticas não se aplicam à Confederação.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        {status && (
          <p className={`text-sm ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {status.message}
          </p>
        )}
        {canManageSystem && (
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Salvando...' : 'Salvar preferências'}
          </Button>
        )}
      </div>
    </div>
  );
}
