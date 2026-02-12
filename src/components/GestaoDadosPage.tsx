import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { Cooperativa, CooperativaConfig } from '../types';
import { parseTabularFile } from '../utils/import/parseTabularFile';
import { ApiError } from '../utils/api/client';

import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const stripImportFields = (rows: Record<string, unknown>[], mode: 'single' | 'bulk') => {
  // Regras: ignorar "ativo" sempre; no modo single o destino vem da tela, não do arquivo.
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    delete (out as any).ativo;
    if (mode === 'single') delete (out as any).id_singular;
    return out;
  });
};

const FIELD_UI_LABELS: Record<string, string> = {
  cd_municipio_7: 'IBGE',
};

const toUiFieldName = (field: string) => FIELD_UI_LABELS[field] ?? field;

type AuxResourceKey =
  | 'auditores'
  | 'conselhos'
  | 'contatos'
  | 'diretores'
  | 'enderecos'
  | 'lgpd'
  | 'ouvidores'
  | 'plantao';

type ResourceGuide = {
  description: string;
  required: string[];
  optional: string[];
  valueHints?: Array<{ field: string; values: string[]; note?: string }>;
};

const AUX_RESOURCES: {
  key: AuxResourceKey;
  title: string;
  templateColumns: string[];
  templateExamples?: Record<string, string>[];
  guide: ResourceGuide;
}[] = [
  {
    key: 'auditores',
    title: 'Auditores',
    templateColumns: ['primeiro_nome', 'sobrenome', 'telefone_celular', 'email'],
    guide: {
      description: 'Cadastro de auditores vinculados à singular.',
      required: ['primeiro_nome'],
      optional: ['sobrenome', 'telefone_celular', 'email'],
    },
  },
  {
    key: 'conselhos',
    title: 'Conselhos',
    templateColumns: ['tipo', 'posicao', 'primeiro_nome', 'sobrenome', 'ano_inicio_mandato', 'ano_fim_mandato'],
    guide: {
      description: 'Conselhos fiscal, administrativo e técnico (titular/suplente).',
      required: ['tipo', 'posicao', 'primeiro_nome'],
      optional: ['sobrenome', 'ano_inicio_mandato', 'ano_fim_mandato'],
      valueHints: [
        { field: 'tipo', values: ['Fiscal', 'Administrativo', 'Técnico'], note: 'Também aceita variações e normaliza automaticamente.' },
        { field: 'posição', values: ['Titular', 'Suplente'] },
      ],
    },
  },
  {
    key: 'contatos',
    title: 'Contatos',
    templateColumns: ['tipo', 'subtipo', 'valor', 'principal'],
    templateExamples: [
      { tipo: 'email', subtipo: 'lgpd', valor: 'lgpd@cooperativa.coop.br', principal: '1' },
      { tipo: 'telefone', subtipo: 'plantão', valor: '1133334444', principal: '0' },
      { tipo: 'whatsapp', subtipo: 'geral', valor: '11999998888', principal: '0' },
      { tipo: 'telefone', subtipo: 'emergência', valor: '0800123456', principal: '0' },
      { tipo: 'email', subtipo: 'divulgação', valor: 'contato@cooperativa.coop.br', principal: '0' },
      { tipo: 'telefone', subtipo: 'divulgação', valor: '1132104567', principal: '0' },
      { tipo: 'whatsapp', subtipo: 'divulgação', valor: '11987654321', principal: '0' },
      { tipo: 'outro', subtipo: 'divulgação', valor: 'canal oficial', principal: '0' },
      { tipo: 'telefone', subtipo: 'comercial pf', valor: '11981234567', principal: '0' },
      { tipo: 'telefone', subtipo: 'comercial pj', valor: '1131234567', principal: '0' },
    ],
    guide: {
      description: 'Contatos gerais e operacionais. Neste cadastro: grupo = tipo e subgrupo = subtipo.',
      required: ['tipo', 'subtipo', 'valor'],
      optional: ['principal'],
      valueHints: [
        { field: 'tipo (grupo)', values: ['E-mail', 'Telefone', 'WhatsApp', 'Outro'] },
        { field: 'subtipo (subgrupo)', values: ['LGPD', 'Plantão', 'Geral', 'Emergência', 'Divulgação', 'Comercial PF', 'Comercial PJ'] },
        { field: 'principal', values: ['true/false', '1/0', 'sim/nao'], note: 'Se não informar, assume false.' },
        { field: 'valor', values: ['somente números para telefone/whatsapp'], note: 'Não usar parênteses, traços, espaços ou +55.' },
      ],
    },
  },
  {
    key: 'diretores',
    title: 'Diretores',
    templateColumns: ['cargo', 'pasta', 'primeiro_nome', 'sobrenome', 'email', 'telefone_celular', 'inicio_mandato', 'fim_mandato'],
    guide: {
      description: 'Diretores da singular.',
      required: ['primeiro_nome'],
      optional: ['cargo', 'pasta', 'sobrenome', 'email', 'telefone_celular', 'inicio_mandato', 'fim_mandato'],
    },
  },
  {
    key: 'enderecos',
    title: 'Endereços',
    templateColumns: ['tipo', 'cd_municipio_7', 'nome_local', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'telefone_fixo', 'telefone_celular'],
    templateExamples: [
      {
        tipo: 'sede',
        cd_municipio_7: '3550308',
        nome_local: 'Sede Administrativa',
        cep: '01001000',
        logradouro: 'Praca da Se',
        numero: '100',
        complemento: '',
        bairro: 'Se',
        telefone_fixo: '1133334444',
        telefone_celular: '11999998888',
      },
    ],
    guide: {
      description: 'Endereços de sede, filial, atendimento e correspondência. Informe o código IBGE e o sistema preenche cidade/UF automaticamente.',
      required: ['tipo', 'cd_municipio_7'],
      optional: ['nome_local', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'telefone_fixo', 'telefone_celular'],
      valueHints: [
        { field: 'tipo', values: ['Sede', 'Filial', 'Atendimento', 'Correspondência'] },
        { field: 'IBGE', values: ['7 dígitos'], note: 'Use o código oficial do município para evitar divergência de cidade/UF.' },
        { field: 'cep/telefone_fixo/telefone_celular', values: ['somente números'], note: 'Não usar ponto, traço, barra, parênteses ou espaços.' },
      ],
    },
  },
  {
    key: 'lgpd',
    title: 'LGPD',
    templateColumns: ['primeiro_nome', 'sobrenome', 'email', 'telefone'],
    guide: {
      description: 'Contato oficial LGPD da singular.',
      required: ['primeiro_nome', 'email'],
      optional: ['sobrenome', 'telefone'],
    },
  },
  {
    key: 'ouvidores',
    title: 'Ouvidores',
    templateColumns: ['primeiro_nome', 'sobrenome', 'telefone_fixo', 'telefone_celular', 'email'],
    guide: {
      description: 'Responsáveis de ouvidoria.',
      required: ['primeiro_nome'],
      optional: ['sobrenome', 'telefone_fixo', 'telefone_celular', 'email'],
    },
  },
  {
    key: 'plantao',
    title: 'Plantão 24h',
    templateColumns: ['modelo_atendimento', 'descricao'],
    guide: {
      description: 'Modelo de atendimento de plantão/urgência/emergência.',
      required: ['modelo_atendimento'],
      optional: ['descricao'],
    },
  },
];

const escapeCsv = (value: unknown) => {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const downloadCsv = (filename: string, headers: string[], rows: Record<string, unknown>[] = []) => {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h] ?? '')).join(','));
  }
  const content = `${lines.join('\n')}\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export function GestaoDadosPage() {
  const { user } = useAuth();
  const [cooperativas, setCooperativas] = useState<Cooperativa[]>([]);
  const [cooperativaTipo, setCooperativaTipo] = useState<CooperativaConfig['tipo'] | null>(null);
  const [activeResource, setActiveResource] = useState<AuxResourceKey>('auditores');
  const [importMode, setImportMode] = useState<'single' | 'bulk'>('single');
  const [targetSingular, setTargetSingular] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalidIds, setInvalidIds] = useState<string[]>([]);
  const [invalidRows, setInvalidRows] = useState<Array<{ line: number; id_singular: string; row: Record<string, unknown> }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const canBulkImport = cooperativaTipo === 'FEDERACAO' || cooperativaTipo === 'CONFEDERACAO';

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!user?.cooperativa_id) return;
      try {
        const [list, cfg] = await Promise.all([
          apiService.getCooperativas(),
          apiService.getCooperativaConfig(user.cooperativa_id),
        ]);
        if (!active) return;
        setCooperativas(list || []);
        setCooperativaTipo(cfg?.tipo ?? null);
        setTargetSingular(user.cooperativa_id);
      } catch (e) {
        console.error('Erro ao carregar dados de gestão:', e);
        if (!active) return;
        setCooperativas([]);
        setCooperativaTipo(null);
        setTargetSingular(user?.cooperativa_id || '');
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [user?.cooperativa_id]);

  useEffect(() => {
    if (importMode === 'bulk' && !canBulkImport) {
      setImportMode('single');
    }
  }, [importMode, canBulkImport]);

  const visibleCooperativas = useMemo(() => {
    return cooperativas
      .slice()
      .sort((a, b) => (a.nome_singular || '').localeCompare(b.nome_singular || '', 'pt-BR'));
  }, [cooperativas]);

  const currentResourceDef = useMemo(
    () => AUX_RESOURCES.find((r) => r.key === activeResource) ?? AUX_RESOURCES[0],
    [activeResource],
  );

  const handleChooseFile = useCallback(async (f: File | null) => {
    setFile(f);
    setResult(null);
    setError(null);
    setInvalidIds([]);
    setInvalidRows([]);
    setPreview([]);
    if (!f) return;
    try {
      const parsed = stripImportFields(await parseTabularFile(f), importMode);
      setPreview(parsed.slice(0, 50));
    } catch (e) {
      console.error('Erro parse import:', e);
      setError('Não foi possível ler o arquivo. Use CSV/XLSX com cabeçalho na primeira linha.');
    }
  }, [importMode]);

  const handleDownloadTemplate = useCallback((mode: 'single' | 'bulk') => {
    const headers = mode === 'bulk'
      ? ['id_singular', ...currentResourceDef.templateColumns]
      : [...currentResourceDef.templateColumns];
    const examples = (currentResourceDef.templateExamples ?? []).map((row) => {
      if (mode === 'bulk') {
        return {
          id_singular: user?.cooperativa_id || '001',
          ...row,
        };
      }
      return row;
    });
    downloadCsv(`template_${currentResourceDef.key}_${mode}.csv`, headers, examples);
  }, [currentResourceDef, user?.cooperativa_id]);

  const handleImport = useCallback(async () => {
    setError(null);
    setResult(null);
    setInvalidIds([]);
    setInvalidRows([]);
    if (!file) {
      setError('Selecione um arquivo CSV/XLSX antes de importar.');
      return;
    }
    setIsLoading(true);
    let parsedForError: Record<string, unknown>[] = [];
    try {
      const parsedRaw = await parseTabularFile(file);
      const parsed = stripImportFields(parsedRaw, importMode);
      parsedForError = parsed;
      if (!parsed.length) {
        setError('Nenhuma linha encontrada no arquivo.');
        return;
      }
      const firstKeys = new Set(Object.keys(parsed[0] || {}));
      const missingRequired = currentResourceDef.guide.required.filter((col) => !firstKeys.has(col));
      if (missingRequired.length > 0) {
        setError(
          `Arquivo sem colunas obrigatórias para ${currentResourceDef.title}: ${
            missingRequired.map(toUiFieldName).join(', ')
          }.`,
        );
        return;
      }

      if (importMode === 'single') {
        if (!targetSingular) {
          setError('Selecione a singular de destino.');
          return;
        }
        const res = await apiService.importCooperativaAux(targetSingular, activeResource, parsed as any, 'replace');
        setResult(res);
        return;
      }

      // bulk
      if (!canBulkImport) {
        setError('Sua cooperativa não tem permissão para importação em massa.');
        return;
      }
      const res = await apiService.importCooperativaAuxBulk(activeResource, parsed as any, 'replace');
      setResult(res);
    } catch (e) {
      console.error('Erro import:', e);
      if (e instanceof ApiError) {
        setError(e.message || 'Erro ao importar dados.');
        const missing = Array.isArray(e.data?.missing_id_singular)
          ? (e.data.missing_id_singular as unknown[]).map((v) => String(v))
          : [];
        if (missing.length > 0) {
          const missingSet = new Set(missing);
          const rows = parsedForError
            .map((row, idx) => ({
              line: idx + 2, // +2: cabeçalho + index base 1
              id_singular: String((row as any).id_singular ?? ''),
              row,
            }))
            .filter((r) => missingSet.has(r.id_singular))
            .slice(0, 50);
          setInvalidIds(missing);
          setInvalidRows(rows);
        }
      } else {
        setError(e instanceof Error ? e.message : 'Erro ao importar dados.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [file, importMode, targetSingular, activeResource, canBulkImport, currentResourceDef]);

  if (!user) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gestão de dados</h1>
          <p className="text-sm text-gray-600 mt-1">
            Importação via CSV/XLSX com validação de escopo: singular, federação ou confederação.
          </p>
        </div>
      </div>

      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-lg">Importar cadastros auxiliares (cooperativas)</CardTitle>
          <CardDescription className="text-sm">
            Para importação por singular, o sistema força o destino pelo <code>id_singular</code> da tela e recusa arquivos com destino diferente.
            {canBulkImport ? ' Para federação/confederação, você pode importar em massa incluindo a coluna id_singular no arquivo.' : ''}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 mt-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Cadastro</Label>
              <select
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                value={activeResource}
                onChange={(e) => setActiveResource(e.target.value as AuxResourceKey)}
              >
                {AUX_RESOURCES.map((r) => (
                  <option key={r.key} value={r.key}>{r.title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Modo</Label>
              <select
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as any)}
              >
                <option value="single">Por singular (uma cooperativa)</option>
                <option value="bulk" disabled={!canBulkImport}>Em massa (arquivo com id_singular)</option>
              </select>
              {!canBulkImport && (
                <p className="text-xs text-gray-500">Importação em massa só aparece para admin de federação/confederação.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Destino (singular)</Label>
              <select
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:opacity-50"
                value={targetSingular}
                onChange={(e) => setTargetSingular(e.target.value)}
                disabled={importMode !== 'single'}
              >
                {visibleCooperativas.map((c) => (
                  <option key={c.id_singular} value={c.id_singular}>
                    {c.id_singular} • {c.nome_singular || c.raz_social || c.id_singular}
                  </option>
                ))}
              </select>
              {importMode !== 'single' && (
                <p className="text-xs text-gray-500">No modo em massa o destino vem do arquivo (coluna id_singular).</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-indigo-900">Instruções de importação: {currentResourceDef.title}</p>
              <p className="text-xs text-indigo-800 mt-1">{currentResourceDef.guide.description}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="font-semibold text-indigo-900">Campos obrigatórios</p>
                <p className="text-indigo-800 mt-1">
                  {currentResourceDef.guide.required.map(toUiFieldName).join(', ')}
                </p>
              </div>
              <div>
                <p className="font-semibold text-indigo-900">Campos opcionais</p>
                <p className="text-indigo-800 mt-1">
                  {currentResourceDef.guide.optional.map(toUiFieldName).join(', ') || '—'}
                </p>
              </div>
            </div>
            {currentResourceDef.guide.valueHints && currentResourceDef.guide.valueHints.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-indigo-900">Valores esperados (futuros dropdowns)</p>
                {currentResourceDef.guide.valueHints.map((hint) => (
                  <div key={hint.field} className="text-xs text-indigo-800">
                    <span className="font-semibold">{hint.field}:</span> {hint.values.join(' | ')}
                    {hint.note ? ` (${hint.note})` : ''}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-indigo-800">
              Regras gerais: <code>id_singular</code> sempre com 3 dígitos (ex.: 001); coluna <code>ativo</code> é ignorada no arquivo e gravada como ativo; campos numéricos de código (CPF, CNPJ, telefones, IBGE) devem ser informados apenas com números.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label>Arquivo (CSV/XLSX)</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => void handleChooseFile(e.target.files?.[0] || null)}
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => handleDownloadTemplate('single')}>
                  Baixar template (singular)
                </Button>
                <Button type="button" variant="outline" onClick={() => handleDownloadTemplate('bulk')} disabled={!canBulkImport}>
                  Baixar template (massa)
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" onClick={handleImport} disabled={isLoading}>
                {isLoading ? 'Importando...' : 'Importar (substituir)'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div>{error}</div>
              {invalidIds.length > 0 && (
                <div className="mt-2 text-xs text-red-800">
                  <strong>ID(s) não encontrado(s):</strong> {invalidIds.join(', ')}
                </div>
              )}
              {invalidRows.length > 0 && (
                <div className="mt-3 rounded-lg border border-red-200 bg-white overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linha</TableHead>
                        <TableHead>id_singular</TableHead>
                        <TableHead>primeiro_nome</TableHead>
                        <TableHead>sobrenome</TableHead>
                        <TableHead>cargo</TableHead>
                        <TableHead>pasta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invalidRows.map((r, i) => (
                        <TableRow key={`${r.line}-${r.id_singular}-${i}`}>
                          <TableCell>{r.line}</TableCell>
                          <TableCell>{r.id_singular}</TableCell>
                          <TableCell>{String((r.row as any).primeiro_nome ?? '')}</TableCell>
                          <TableCell>{String((r.row as any).sobrenome ?? '')}</TableCell>
                          <TableCell>{String((r.row as any).cargo ?? '')}</TableCell>
                          <TableCell>{String((r.row as any).pasta ?? '')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 space-y-2">
              <div><strong>Resultado:</strong> {result.inserted ?? 0} registro(s) importado(s).</div>
              {Array.isArray(result.denied) && result.denied.length > 0 && (
                <div><strong>Negados:</strong> {result.denied.join(', ')}</div>
              )}
              {result.targets && typeof result.targets === 'object' && (
                <div className="text-xs text-emerald-900">
                  {Object.entries(result.targets).slice(0, 15).map(([id, v]: any) => (
                    <div key={id}>{id}: {v?.inserted ?? 0}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Pré-visualização (até 50 linhas)</p>
            {!preview.length ? (
              <p className="text-sm text-gray-500">Nenhum dado carregado ainda.</p>
            ) : (
              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(preview[0] || {}).slice(0, 10).map((k) => (
                        <TableHead key={k}>{k}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 10).map((row, idx) => (
                      <TableRow key={idx}>
                        {Object.keys(preview[0] || {}).slice(0, 10).map((k) => (
                          <TableCell key={k}>{String((row as any)[k] ?? '')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.length > 10 && (
                  <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
                    Mostrando 10 de {preview.length} linhas (prévia).
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="p-0 mt-6">
          <p className="text-xs text-gray-500">
            Observação: o backend sempre valida se você pode importar para cada <code>id_singular</code>.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
