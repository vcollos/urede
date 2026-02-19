import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Pencil, RefreshCcw, Save, X } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { Cooperativa, PessoaUnificada } from '../types';

import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

type PessoasViewProps = {
  idSingular?: string;
  canEdit?: boolean;
  embedded?: boolean;
};

type PessoaDraft = {
  categoria: string;
  subcategoria: string;
  primeiro_nome: string;
  sobrenome: string;
  email: string;
  telefone: string;
  wpp: boolean;
  departamento: string;
  cargo_funcao: string;
  ativo: boolean;
};

const DEFAULT_DEPARTAMENTOS = ['INTERCÂMBIO', 'COMERCIAL', 'ATENDIMENTO', 'FINANCEIRO'];

const CATEGORIAS: Array<{ value: string; label: string }> = [
  { value: 'diretoria', label: 'Diretoria' },
  { value: 'regulatorio', label: 'Regulatório' },
  { value: 'conselho', label: 'Conselho' },
  { value: 'colaborador', label: 'Colaborador' },
  { value: 'ouvidoria', label: 'Ouvidoria' },
  { value: 'lgpd', label: 'LGPD' },
  { value: 'auditoria', label: 'Auditoria' },
  { value: 'dentista', label: 'Dentista' },
];

const toBool = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'sim', 's', 'yes', 'y'].includes(normalized);
};

const normalizeDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

const formatPhone = (value: unknown) => {
  let digits = normalizeDigits(value);
  if (!digits) return '—';
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0800')) {
    const base = digits.slice(0, 12);
    if (base.length <= 4) return base;
    if (base.length <= 8) return `${base.slice(0, 4)} ${base.slice(4)}`;
    return `${base.slice(0, 4)} ${base.slice(4, 8)} ${base.slice(8, 12)}`;
  }
  if (digits.length === 11 && digits[2] === '9') {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length <= 10) {
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const capitalizeWords = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatCategoria = (value: string) => {
  const found = CATEGORIAS.find((item) => item.value === String(value ?? '').toLowerCase());
  return found?.label || capitalizeWords(String(value ?? ''));
};

const normalizeCatalog = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const item of value) {
    const normalized = String(item ?? '').replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(normalized);
  }
  return list;
};

export function PessoasView({ idSingular, canEdit, embedded = false }: PessoasViewProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<PessoaUnificada[]>([]);
  const [cooperativas, setCooperativas] = useState<Cooperativa[]>([]);
  const [departamentoOptions, setDepartamentoOptions] = useState<string[]>(DEFAULT_DEPARTAMENTOS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('all');
  const [singularFilter, setSingularFilter] = useState<string>(idSingular ?? 'all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PessoaDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const allowEdit = canEdit ?? (user?.papel === 'admin');
  const globalMode = !idSingular;
  const resolvedIdSingular = idSingular || (singularFilter !== 'all' ? singularFilter : undefined);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await apiService.getPessoas({
        id_singular: resolvedIdSingular,
        categoria: categoriaFilter !== 'all' ? categoriaFilter : undefined,
        q: search.trim() || undefined,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[pessoas] erro ao carregar:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar pessoas');
    } finally {
      setIsLoading(false);
    }
  }, [categoriaFilter, resolvedIdSingular, search]);

  useEffect(() => {
    let active = true;
    if (!globalMode) return () => {
      active = false;
    };
    const loadCooperativas = async () => {
      try {
        const data = await apiService.getCooperativas();
        if (active) {
          setCooperativas(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('[pessoas] erro ao carregar cooperativas:', err);
      }
    };
    loadCooperativas();
    return () => {
      active = false;
    };
  }, [globalMode]);

  useEffect(() => {
    let active = true;
    const loadCatalogs = async () => {
      try {
        const settings = await apiService.getSystemSettings();
        if (!active) return;
        const options = normalizeCatalog(settings?.hub_cadastros?.departamentos);
        setDepartamentoOptions(options.length ? options : DEFAULT_DEPARTAMENTOS);
      } catch (err) {
        console.error('[pessoas] erro ao carregar catálogo de departamentos:', err);
        if (active) setDepartamentoOptions(DEFAULT_DEPARTAMENTOS);
      }
    };
    void loadCatalogs();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [load]);

  const startEdit = (row: PessoaUnificada) => {
    setEditingId(row.vinculo_id);
    setDraft({
      categoria: String(row.categoria ?? ''),
      subcategoria: String(row.subcategoria ?? ''),
      primeiro_nome: String(row.primeiro_nome ?? ''),
      sobrenome: String(row.sobrenome ?? ''),
      email: String(row.email ?? ''),
      telefone: normalizeDigits(row.telefone),
      wpp: toBool(row.wpp),
      departamento: String(row.departamento ?? ''),
      cargo_funcao: String(row.cargo_funcao ?? ''),
      ativo: toBool(row.ativo ?? true),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setSavingId(null);
  };

  const handleSave = async (row: PessoaUnificada) => {
    if (!draft || !editingId) return;
    try {
      setSavingId(editingId);
      const payload = {
        categoria: draft.categoria,
        subcategoria: draft.subcategoria.trim() || null,
        primeiro_nome: draft.primeiro_nome.trim(),
        sobrenome: draft.sobrenome.trim() || null,
        email: draft.email.trim() || null,
        telefone: normalizeDigits(draft.telefone) || null,
        wpp: draft.wpp,
        departamento: draft.departamento.trim() || null,
        cargo_funcao: draft.cargo_funcao.trim() || null,
        ativo: draft.ativo,
      };
      const updated = await apiService.updatePessoaVinculo(editingId, payload);
      setRows((prev) => prev.map((item) => (item.vinculo_id === row.vinculo_id ? updated : item)));
      cancelEdit();
    } catch (err) {
      console.error('[pessoas] erro ao salvar:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar pessoa');
      setSavingId(null);
    }
  };

  const content = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Pessoas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, e-mail, telefone..."
            className="md:col-span-2"
          />
          {globalMode && (
            <Select value={singularFilter} onValueChange={setSingularFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Singular" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as singulares</SelectItem>
                {cooperativas.map((coop) => (
                  <SelectItem key={coop.id_singular} value={coop.id_singular}>
                    {coop.id_singular} · {coop.uniodonto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIAS.map((categoria) => (
                <SelectItem key={categoria.value} value={categoria.value}>
                  {categoria.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={() => void load()} className={globalMode ? '' : 'md:col-span-1'}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {globalMode && <TableHead>Singular</TableHead>}
                <TableHead>Categoria</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Sobrenome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Cargo/Função</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={globalMode ? 10 : 9} className="py-8 text-center text-sm text-gray-500">
                    Carregando pessoas...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={globalMode ? 10 : 9} className="py-8 text-center text-sm text-gray-500">
                    Nenhuma pessoa encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : rows.map((row) => {
                const isEditing = editingId === row.vinculo_id && !!draft;
                const currentDepartamento = String(draft?.departamento ?? '').trim();
                const departamentoSelectValue = currentDepartamento || '__none__';
                const extraDepartamentoOption = currentDepartamento
                  && !departamentoOptions.some((item) => item.toLowerCase() === currentDepartamento.toLowerCase())
                  ? currentDepartamento
                  : '';
                return (
                  <TableRow key={row.vinculo_id}>
                    {globalMode && (
                      <TableCell className="text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">{row.id_singular}</span>
                          <span className="text-gray-500">{row.singular_nome}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={draft.categoria || 'colaborador'}
                          onValueChange={(value) => setDraft((prev) => (prev ? { ...prev, categoria: value } : prev))}
                        >
                          <SelectTrigger className="h-8 w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS.map((categoria) => (
                              <SelectItem key={categoria.value} value={categoria.value}>
                                {categoria.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">{formatCategoria(row.categoria)}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={draft.primeiro_nome}
                          onChange={(event) => setDraft((prev) => (prev ? { ...prev, primeiro_nome: event.target.value } : prev))}
                          className="h-8 min-w-[120px]"
                        />
                      ) : (
                        row.primeiro_nome || '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={draft.sobrenome}
                          onChange={(event) => setDraft((prev) => (prev ? { ...prev, sobrenome: event.target.value } : prev))}
                          className="h-8 min-w-[140px]"
                        />
                      ) : (
                        row.sobrenome || '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={draft.email}
                          onChange={(event) => setDraft((prev) => (prev ? { ...prev, email: event.target.value } : prev))}
                          className="h-8 min-w-[180px]"
                        />
                      ) : (
                        row.email || '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex min-w-[170px] items-center gap-2">
                          <Input
                            value={draft.telefone}
                            onChange={(event) => setDraft((prev) => (prev ? { ...prev, telefone: normalizeDigits(event.target.value) } : prev))}
                            className="h-8"
                          />
                          <Switch
                            checked={draft.wpp}
                            onCheckedChange={(checked) => setDraft((prev) => (prev ? { ...prev, wpp: checked } : prev))}
                            aria-label="É WhatsApp"
                          />
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span>{formatPhone(row.telefone)}</span>
                          {toBool(row.wpp) && <i className="fa-brands fa-whatsapp text-emerald-600 text-sm" aria-label="WhatsApp" />}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={departamentoSelectValue}
                          onValueChange={(value) => setDraft((prev) => (
                            prev ? { ...prev, departamento: value === '__none__' ? '' : value } : prev
                          ))}
                        >
                          <SelectTrigger className="h-8 min-w-[160px]">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {extraDepartamentoOption && (
                              <SelectItem value={extraDepartamentoOption}>
                                {extraDepartamentoOption}
                              </SelectItem>
                            )}
                            {departamentoOptions.map((departamento) => (
                              <SelectItem key={departamento} value={departamento}>
                                {departamento}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        row.departamento || '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={draft.cargo_funcao}
                          onChange={(event) => setDraft((prev) => (prev ? { ...prev, cargo_funcao: event.target.value } : prev))}
                          className="h-8 min-w-[160px]"
                        />
                      ) : (
                        row.cargo_funcao || '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Switch
                          checked={draft.ativo}
                          onCheckedChange={(checked) => setDraft((prev) => (prev ? { ...prev, ativo: checked } : prev))}
                          aria-label="Registro ativo"
                        />
                      ) : (
                        toBool(row.ativo) ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!allowEdit ? (
                        <span className="text-xs text-gray-400">Somente leitura</span>
                      ) : isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleSave(row)}
                            disabled={savingId === row.vinculo_id}
                          >
                            <Save className="mr-1 h-3.5 w-3.5" />
                            Salvar
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(row)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Editar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  if (embedded) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pessoas</h1>
        <p className="text-sm text-gray-600">
          Cadastro unificado de pessoas com manutenção inline por singular e categoria.
        </p>
      </div>
      {content}
    </div>
  );
}
