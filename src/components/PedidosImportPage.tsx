import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import { read, utils } from 'xlsx';
import { apiService } from '../services/apiService';
import type {
  PedidoImportPayloadItem,
  PedidoImportResponse,
} from '../types';

const NONE_VALUE = '__none__';

const AVAILABLE_SPECIALTIES = [
  'Clínica Geral',
  'Ortodontia',
  'Endodontia',
  'Periodontia',
  'Cirurgia Oral',
  'Cirurgia Bucomaxilofacial',
  'Implantodontia',
  'Prótese Dentária',
  'Odontopediatria',
  'Radiologia Oral',
];

const DESTINATION_FIELDS: Array<{
  key: keyof PedidoImportPayloadItem;
  label: string;
  required: boolean;
  description: string;
}> = [
  {
    key: 'titulo',
    label: 'Título',
    required: true,
    description: 'Nome que identifica o pedido de credenciamento.',
  },
  {
    key: 'especialidade',
    label: 'Especialidade',
    required: true,
    description: 'Especialidades separadas por ponto e vírgula ou vírgula.',
  },
  {
    key: 'cidadeCodigo',
    label: 'Cidade (código IBGE)',
    required: true,
    description: 'Informe o código IBGE com 6 ou 7 dígitos.',
  },
  {
    key: 'responsavelEmail',
    label: 'Responsável (email)',
    required: false,
    description: 'Email do operador responsável pelo acompanhamento.',
  },
  {
    key: 'detalhes',
    label: 'Detalhes / Observações',
    required: false,
    description: 'Informações adicionais que ajudem na triagem.',
  },
];

const FIELD_SYNONYMS: Record<string, string[]> = {
  titulo: ['titulo', 'título', 'nome', 'assunto', 'pedido'],
  especialidade: ['especialidade', 'especialidades', 'area', 'área'],
  cidadeCodigo: [
    'cidade_ibge',
    'ibge',
    'codigo_ibge',
    'código_ibge',
    'cidade',
    'codigo_cidade',
    'código_cidade',
    'municipio',
    'município',
  ],
  responsavelEmail: [
    'responsavel',
    'responsável',
    'responsavel_email',
    'responsável_email',
    'email_responsavel',
  ],
  detalhes: ['detalhes', 'observacoes', 'observações', 'descricao', 'descrição', 'comentarios'],
};

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const autoDetectMapping = (headers: string[]) => {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  for (const field of DESTINATION_FIELDS) {
    const synonyms = FIELD_SYNONYMS[field.key] || [];
    const found = normalizedHeaders.find(({ normalized }) =>
      synonyms.includes(normalized)
    );
    if (found) {
      mapping[field.key] = found.original;
    }
  }

  return mapping;
};

const readSpreadsheetFile = async (file: File) =>
  new Promise<{
    headers: string[];
    rows: Record<string, string>[];
  }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error('Arquivo sem planilha ou conteúdo.'));
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const matrix = utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
        }) as Array<string[]>;
        if (!matrix || matrix.length < 1) {
          reject(new Error('Planilha vazia.'));
          return;
        }
        const [headerRow, ...dataRows] = matrix;
        const headers = headerRow
          .map((value) => value?.toString().trim())
          .filter((value): value is string => value !== undefined && value !== '');
        if (headers.length === 0) {
          reject(new Error('Cabeçalho do arquivo não encontrado.'));
          return;
        }
        const rows = dataRows
          .map((cells) => {
            const row: Record<string, string> = {};
            headers.forEach((header, index) => {
              row[header] = (cells[index] ?? '').toString();
            });
            const hasContent = Object.values(row).some((value) =>
              value !== undefined && value !== null && value.toString().trim() !== ''
            );
            return hasContent ? row : null;
          })
          .filter((row): row is Record<string, string> => row !== null);
        resolve({ headers, rows });
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Erro ao processar arquivo.'));
      }
    };
    reader.readAsArrayBuffer(file);
  });

type ImportStep = 'upload' | 'mapping' | 'review' | 'result';

type PedidosImportPageProps = {
  onBack: () => void;
  onCompleted?: (response: PedidoImportResponse) => void;
};

export function PedidosImportPage({ onBack, onCompleted }: PedidosImportPageProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [preflightIssues, setPreflightIssues] = useState<
    Array<{ rowNumber: number; message: string }>
  >([]);
  const [preparedRows, setPreparedRows] = useState<PedidoImportPayloadItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<PedidoImportResponse | null>(null);

  const resetState = useCallback(() => {
    setStep('upload');
    setSelectedFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setMappingError(null);
    setParseError(null);
    setPreparedRows([]);
    setPreflightIssues([]);
    setResult(null);
    setIsProcessing(false);
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setParseError(null);
      setIsProcessing(true);
      const parsed = await readSpreadsheetFile(file);
      if (parsed.rows.length === 0) {
        setParseError('Nenhuma linha com dados foi encontrada.');
        setIsProcessing(false);
        return;
      }
      setSelectedFile(file);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoDetectMapping(parsed.headers));
      setStep('mapping');
    } catch (error) {
      console.error('[importação] falha ao ler arquivo:', error);
      setParseError(
        error instanceof Error
          ? error.message
          : 'Não foi possível interpretar o arquivo selecionado.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const updateMapping = (field: string, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value === NONE_VALUE ? '' : value,
    }));
    setMappingError(null);
  };

  const mappedHeaders = useMemo(
    () => new Set(Object.values(mapping).filter(Boolean)),
    [mapping],
  );

  const readyToReview = useMemo(() =>
    DESTINATION_FIELDS.every((field) =>
      !field.required || (mapping[field.key] && mapping[field.key] !== NONE_VALUE)
    ),
  [mapping]);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const buildPreparedRows = () => {
    const records: PedidoImportPayloadItem[] = [];
    const issues: Array<{ rowNumber: number; message: string }> = [];

    rows.forEach((row, index) => {
      const record: PedidoImportPayloadItem = {
        rowNumber: index + 2,
        titulo: '',
        especialidade: '',
        cidadeCodigo: '',
        responsavelEmail: '',
        detalhes: '',
      };

      for (const field of DESTINATION_FIELDS) {
        const sourceHeader = mapping[field.key];
        if (!sourceHeader) continue;
        const value = (row[sourceHeader] ?? '').toString().trim();
        (record as any)[field.key] = value;
      }

      const hasAnyValue = DESTINATION_FIELDS.some((field) => {
        const value = (record as any)[field.key];
        return typeof value === 'string' ? value.trim() !== '' : value !== undefined && value !== null;
      });

      if (!hasAnyValue) {
        return;
      }

      const missingFields = DESTINATION_FIELDS.filter(
        (field) => field.required && !(record as any)[field.key]
      );

      if (missingFields.length > 0) {
        issues.push({
          rowNumber: record.rowNumber,
          message: `Campos obrigatórios ausentes: ${missingFields
            .map((field) => field.label)
            .join(', ')}`,
        });
        return;
      }

      records.push(record);
    });

    return { records, issues };
  };

  const handleValidateMapping = () => {
    if (!readyToReview) {
      setMappingError('Mapeie todas as colunas obrigatórias antes de continuar.');
      return;
    }

    const { records, issues } = buildPreparedRows();
    setPreparedRows(records);
    setPreflightIssues(issues);

    if (records.length === 0) {
      setMappingError('Nenhuma linha válida encontrada após o mapeamento.');
      return;
    }

    setStep('review');
  };

  const handleBackStep = () => {
    if (isProcessing) return;
    if (step === 'mapping') {
      setStep('upload');
      return;
    }
    if (step === 'review') {
      setStep('mapping');
      return;
    }
    if (step === 'result') {
      setStep('review');
      return;
    }
    onBack();
  };

  const handleSubmit = async () => {
    if (preparedRows.length === 0) {
      setMappingError('Nenhum dado preparado para importação.');
      return;
    }
    setIsProcessing(true);
    try {
      const response = await apiService.importPedidos({
        items: preparedRows,
        meta: {
          originalFilename: selectedFile?.name,
          mapping,
        },
      });
      setResult(response);
      setStep('result');
      if (response.summary.imported > 0) {
        window.dispatchEvent(new Event('pedido:created'));
      }
      onCompleted?.(response);
    } catch (error) {
      console.error('[importação] falha ao processar pedidos:', error);
      setMappingError(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir a importação. Tente novamente.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadErrors = () => {
    if (!result?.errors?.length) return;
    const headers = ['Linha', 'Erro', 'Título', 'Especialidade', 'Cidade IBGE'];
    const csvLines = [headers.join(';')];
    result.errors.forEach((err) => {
      const rowNumber = err.rowNumber ?? '';
      const message = err.message?.replace(/;/g, ',') ?? '';
      const titulo = (err.details as any)?.titulo ?? '';
      const especialidade = (err.details as any)?.especialidade ?? '';
      const cidade = (err.details as any)?.cidadeCodigo ?? '';
      csvLines.push(
        [rowNumber, message, titulo, especialidade, cidade]
          .map((value) => `"${value?.toString().replace(/"/g, '""')}"`)
          .join(';')
      );
    });
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `erros_importacao_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            className="w-fit px-0 text-sm text-purple-600 hover:text-purple-700"
            onClick={onBack}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para pedidos
          </Button>
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Importação em lote</h1>
            <p className="text-gray-600">
              Baixe o template, prepare o arquivo com os pedidos e acompanhe o passo a passo
              para importar tudo de uma vez.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => window.open('/templates/pedidos_lote.csv', '_blank')}
          >
            <Download className="h-4 w-4" />
            Baixar template CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Como preparar o arquivo</CardTitle>
          <CardDescription>
            Preencha as colunas obrigatórias e siga as orientações abaixo para evitar rejeições.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-700">
          <div>
            <p className="font-semibold text-gray-900">Especialidades disponíveis</p>
            <p className="mt-2 text-sm">
              Utilize exatamente a grafia abaixo para que o sistema identifique corretamente cada área.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[280px] divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-gray-600">Especialidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {AVAILABLE_SPECIALTIES.map((item) => (
                    <tr key={item}>
                      <td className="px-4 py-2 text-gray-700">{item}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Para múltiplas especialidades no mesmo pedido, separe os valores com vírgula ou ponto e vírgula (ex.: "Clínica Geral; Ortodontia").
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">E-mail do responsável</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Informe o e-mail do operador que acompanhará o pedido na cooperativa.</li>
              <li>Esse endereço recebe as notificações automáticas do sistema.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-900">Códigos IBGE de cidade</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Digite o código IBGE de 6 dígitos (sem o dígito verificador final).</li>
              <li>Também aceitamos o código completo com 7 dígitos; o sistema ajusta automaticamente.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-900">Dicas adicionais</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Evite linhas vazias no arquivo e mantenha o cabeçalho na primeira linha.</li>
              <li>Os pedidos serão vinculados automaticamente à cooperativa do usuário logado.</li>
              <li>O prazo inicial é calculado com base nas regras de SLA configuradas.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>1. Carregue o arquivo</CardTitle>
            <CardDescription>
              Selecione o arquivo preenchido (CSV ou Excel) para iniciar a importação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <UploadCloud className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Selecione o arquivo de pedidos</h3>
              <p className="mt-2 text-sm text-gray-600">
                Extensões aceitas: .xlsx, .xls ou .csv. Mantenha a primeira linha com o cabeçalho.
              </p>
              <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  onClick={() => document.getElementById('import-file-input')?.click()}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <UploadCloud className="h-4 w-4" />
                  Selecionar arquivo
                </Button>
                {selectedFile && (
                  <span className="text-sm text-gray-600">{selectedFile.name}</span>
                )}
              </div>
              <Input
                id="import-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {parseError && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {parseError}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>2. Mapeie as colunas</CardTitle>
              <CardDescription>
                Relacione os campos do sistema com as colunas presentes no arquivo importado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {DESTINATION_FIELDS.map((field) => {
                  const value = mapping[field.key] ?? '';
                  const isRequired = field.required;
                  const error = mappingError && isRequired && !value;
                  return (
                    <div key={field.key} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-800">
                          {field.label}
                          {isRequired && <span className="text-red-500"> *</span>}
                        </label>
                        {value && mappedHeaders.has(value) && (
                          <span className="text-xs text-gray-400">{value}</span>
                        )}
                      </div>
                      <Select
                        value={value || NONE_VALUE}
                        onValueChange={(selected) => updateMapping(field.key, selected)}
                      >
                        <SelectTrigger className={error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}>
                          <SelectValue placeholder="Selecionar coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>Não utilizar</SelectItem>
                          {headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">{field.description}</p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  Pré-visualização (primeiras linhas)
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {headers.map((header) => (
                          <th key={header} className="px-3 py-2 text-left font-medium uppercase tracking-wide text-gray-500">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewRows.map((row, idx) => (
                        <tr key={idx}>
                          {headers.map((header) => (
                            <td key={header} className="px-3 py-2 text-gray-700">
                              {row[header] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {previewRows.length === 0 && (
                        <tr>
                          <td className="px-3 py-4 text-center text-gray-500" colSpan={headers.length}>
                            Nenhuma linha para exibir.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {mappingError && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {mappingError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={handleBackStep} disabled={isProcessing}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button onClick={handleValidateMapping} disabled={!readyToReview || isProcessing}>
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>3. Revise os dados</CardTitle>
              <CardDescription>
                Analise o resumo antes de confirmar a importação. Linhas com problemas serão ignoradas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Linhas carregadas</p>
                  <p className="text-xl font-semibold text-gray-900">{rows.length}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Linhas válidas</p>
                  <p className="text-xl font-semibold text-gray-900">{preparedRows.length}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Possíveis problemas</p>
                  <p className="text-xl font-semibold text-gray-900">{preflightIssues.length}</p>
                </div>
              </div>

              {preflightIssues.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5" />
                    <div>
                      <p className="font-semibold">Algumas linhas serão ignoradas</p>
                      <p className="mt-1 text-sm">
                        Os registros abaixo possuem campos obrigatórios vazios e não serão importados.
                      </p>
                      <ul className="mt-3 space-y-1 text-sm">
                        {preflightIssues.slice(0, 5).map((issue) => (
                          <li key={`${issue.rowNumber}-${issue.message}`}>
                            Linha {issue.rowNumber}: {issue.message}
                          </li>
                        ))}
                      </ul>
                      {preflightIssues.length > 5 && (
                        <p className="mt-2 text-xs text-yellow-700">
                          + {preflightIssues.length - 5} outro(s) registro(s) com o mesmo problema.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  Pré-visualização dos dados mapeados
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-gray-500">Linha</th>
                        {DESTINATION_FIELDS.map((field) => (
                          <th key={field.key} className="px-3 py-2 text-left font-medium uppercase tracking-wide text-gray-500">
                            {field.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {preparedRows.slice(0, 5).map((record) => (
                        <tr key={record.rowNumber}>
                          <td className="px-3 py-2 text-gray-500">{record.rowNumber}</td>
                          {DESTINATION_FIELDS.map((field) => (
                            <td key={field.key} className="px-3 py-2 text-gray-700">
                              {(record as any)[field.key] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {preparedRows.length === 0 && (
                        <tr>
                          <td className="px-3 py-4 text-center text-gray-500" colSpan={DESTINATION_FIELDS.length + 1}>
                            Nenhum dado válido para exibir.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {mappingError && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {mappingError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={handleBackStep} disabled={isProcessing}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button onClick={handleSubmit} disabled={isProcessing || preparedRows.length === 0}>
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                  )}
                  {isProcessing ? 'Importando...' : 'Iniciar importação'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>4. Resultado da importação</CardTitle>
              <CardDescription>
                Acompanhe o resumo abaixo. Baixe o relatório para revisar eventuais inconsistências.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-base font-semibold text-green-700">Importação concluída</p>
                    <p className="mt-1 text-sm text-green-700">
                      {result.summary.imported} pedido(s) criado(s) com sucesso.
                    </p>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-green-700 sm:grid-cols-3">
                      <div>
                        <dt className="uppercase tracking-wide text-green-800/80">Processados</dt>
                        <dd className="text-base font-semibold text-green-800">{result.summary.total}</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide text-green-800/80">Importados</dt>
                        <dd className="text-base font-semibold text-green-800">{result.summary.imported}</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide text-green-800/80">Ignorados</dt>
                        <dd className="text-base font-semibold text-green-800">{result.summary.skipped}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-700" />
                    <div className="space-y-3 text-sm text-yellow-800">
                      <div>
                        <p className="font-semibold">Alguns registros não foram importados</p>
                        <p className="text-sm">
                          Faça o download do relatório para revisar os problemas e tentar novamente.
                        </p>
                      </div>
                      <ul className="space-y-1">
                        {result.errors.slice(0, 5).map((error, index) => (
                          <li key={`${error.rowNumber}-${index}`}>
                            Linha {error.rowNumber}: {error.message}
                          </li>
                        ))}
                      </ul>
                      {result.errors.length > 5 && (
                        <p className="text-xs text-yellow-700">
                          + {result.errors.length - 5} outro(s) registro(s) com o mesmo problema.
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="inline-flex w-fit items-center gap-2"
                        onClick={handleDownloadErrors}
                      >
                        <Download className="h-4 w-4" /> Baixar relatório de erros
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="default" onClick={onBack}>
                  Voltar para pedidos
                </Button>
                <Button variant="secondary" onClick={resetState} className="flex items-center gap-2">
                  <UploadCloud className="h-4 w-4" /> Importar outro arquivo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
