import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Download, Plus, Search, Shield, Upload, X } from 'lucide-react';

import { apiService } from '../services/apiService';
import { parseTabularFile } from '../utils/import/parseTabularFile';
import { useAuth } from '../contexts/AuthContext';
import type { DiretorPhoneAccessRequest } from '../types';

import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from './ui/utils';

const stripImportFields = (rows: Record<string, unknown>[]) => {
  // Regras: ignorar "ativo" na importação; todos entram ativos por padrão.
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    delete (out as any).ativo;
    return out;
  });
};

type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'boolean';

type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
};

type ResourceDef = {
  key: string;
  title: string;
  description?: string;
  displayColumns: { key: string; label: string }[];
  fields: FieldDef[];
  templateExamples?: Record<string, string>[];
};

const RESOURCES: ResourceDef[] = [
  {
    key: 'auditores',
    title: 'Auditores',
    displayColumns: [
      { key: 'primeiro_nome', label: 'Nome' },
      { key: 'sobrenome', label: 'Sobrenome' },
      { key: 'email', label: 'Email' },
      { key: 'telefone_celular', label: 'Celular' },
    ],
    fields: [
      { key: 'primeiro_nome', label: 'Primeiro nome', type: 'text' },
      { key: 'sobrenome', label: 'Sobrenome', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'telefone_celular', label: 'Telefone celular', type: 'text' },
      { key: 'ativo', label: 'Ativo', type: 'boolean' },
    ],
  },
  {
    key: 'conselhos',
    title: 'Conselhos',
    description: 'Conselho fiscal, administrativo e técnico (titular/suplente).',
    displayColumns: [
      { key: 'tipo', label: 'Tipo' },
      { key: 'posicao', label: 'Posição' },
      { key: 'primeiro_nome', label: 'Nome' },
      { key: 'sobrenome', label: 'Sobrenome' },
      { key: 'ano_inicio_mandato', label: 'Início' },
      { key: 'ano_fim_mandato', label: 'Fim' },
    ],
    fields: [
      {
        key: 'tipo',
        label: 'Tipo',
        type: 'select',
        options: [
          { value: 'fiscal', label: 'Fiscal' },
          { value: 'administrativo', label: 'Administrativo' },
          { value: 'tecnico', label: 'Técnico' },
        ],
      },
      {
        key: 'posicao',
        label: 'Posição',
        type: 'select',
        options: [
          { value: 'titular', label: 'Titular' },
          { value: 'suplente', label: 'Suplente' },
        ],
      },
      { key: 'primeiro_nome', label: 'Primeiro nome', type: 'text' },
      { key: 'sobrenome', label: 'Sobrenome', type: 'text' },
      { key: 'ano_inicio_mandato', label: 'Ano início mandato', type: 'number' },
      { key: 'ano_fim_mandato', label: 'Ano fim mandato', type: 'number' },
      { key: 'ativo', label: 'Ativo', type: 'boolean' },
    ],
  },
  {
    key: 'diretores',
    title: 'Diretores',
    displayColumns: [
      { key: 'cargo', label: 'Cargo' },
      { key: 'pasta', label: 'Pasta' },
      { key: 'primeiro_nome', label: 'Nome' },
      { key: 'sobrenome', label: 'Sobrenome' },
      { key: 'email', label: 'Email' },
      { key: 'telefone_celular', label: 'Celular' },
      { key: 'divulgar_celular', label: 'Divulgação' },
      { key: 'inicio_mandato', label: 'Início' },
      { key: 'fim_mandato', label: 'Fim' },
    ],
    fields: [
      { key: 'cargo', label: 'Cargo', type: 'text' },
      { key: 'pasta', label: 'Pasta', type: 'text' },
      { key: 'primeiro_nome', label: 'Primeiro nome', type: 'text' },
      { key: 'sobrenome', label: 'Sobrenome', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'telefone_celular', label: 'Telefone celular', type: 'text' },
      { key: 'divulgar_celular', label: 'Divulgar celular', type: 'boolean' },
      { key: 'inicio_mandato', label: 'Ano início mandato', type: 'number' },
      { key: 'fim_mandato', label: 'Ano fim mandato', type: 'number' },
      { key: 'ativo', label: 'Ativo', type: 'boolean' },
    ],
  },
  {
    key: 'enderecos',
    title: 'Endereços',
    displayColumns: [
      { key: 'tipo', label: 'Tipo' },
      { key: 'nome_local', label: 'Local' },
      { key: 'cd_municipio_7', label: 'IBGE' },
      { key: 'cidade', label: 'Cidade' },
      { key: 'uf', label: 'UF' },
      { key: 'cep', label: 'CEP' },
      { key: 'logradouro', label: 'Logradouro' },
      { key: 'numero', label: 'Nº' },
      { key: 'bairro', label: 'Bairro' },
      { key: 'telefone_fixo', label: 'Fixo' },
      { key: 'telefone_celular', label: 'Celular' },
    ],
    fields: [
      {
        key: 'tipo',
        label: 'Tipo',
        type: 'select',
        options: [
          { value: 'correspondencia', label: 'Correspondência' },
          { value: 'filial', label: 'Filial' },
          { value: 'atendimento', label: 'Atendimento' },
        ],
      },
      { key: 'nome_local', label: 'Nome do local', type: 'text' },
      { key: 'cd_municipio_7', label: 'IBGE', type: 'text' },
      { key: 'cep', label: 'CEP', type: 'text' },
      { key: 'logradouro', label: 'Logradouro', type: 'text' },
      { key: 'numero', label: 'Número', type: 'text' },
      { key: 'complemento', label: 'Complemento', type: 'text' },
      { key: 'bairro', label: 'Bairro', type: 'text' },
      { key: 'cidade', label: 'Cidade', type: 'text' },
      { key: 'uf', label: 'UF', type: 'text' },
      { key: 'telefone_fixo', label: 'Telefone fixo', type: 'text' },
      { key: 'telefone_celular', label: 'Telefone celular', type: 'text' },
      { key: 'ativo', label: 'Ativo', type: 'boolean' },
    ],
    templateExamples: [
      {
        tipo: 'correspondencia',
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
  },
  {
    key: 'contatos',
    title: 'Contatos',
    description: 'Use subtipo para identificar LGPD, plantão 24h, emergência, divulgação, Comercial PF/PJ etc.',
    displayColumns: [
      { key: 'tipo', label: 'Tipo' },
      { key: 'subtipo', label: 'Subtipo' },
      { key: 'valor', label: 'Valor' },
      { key: 'label', label: 'Label' },
      { key: 'principal', label: 'Principal' },
    ],
    fields: [
      {
        key: 'tipo',
        label: 'Tipo',
        type: 'select',
        options: [
          { value: 'email', label: 'E-mail' },
          { value: 'telefone', label: 'Telefone' },
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'outro', label: 'Outro' },
        ],
      },
      {
        key: 'subtipo',
        label: 'Subtipo',
        type: 'select',
        options: [
          { value: 'lgpd', label: 'LGPD' },
          { value: 'plantao', label: 'Plantão' },
          { value: 'geral', label: 'Geral' },
          { value: 'emergencia', label: 'Emergência' },
          { value: 'divulgacao', label: 'Divulgação' },
          { value: 'comercial pf', label: 'Comercial PF' },
          { value: 'comercial pj', label: 'Comercial PJ' },
        ],
      },
      { key: 'valor', label: 'Valor', type: 'text' },
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'principal', label: 'Principal', type: 'boolean' },
      { key: 'ativo', label: 'Ativo', type: 'boolean' },
    ],
    templateExamples: [
      { tipo: 'email', subtipo: 'lgpd', valor: 'lgpd@cooperativa.coop.br', label: 'Encarregado LGPD', principal: '1' },
      { tipo: 'telefone', subtipo: 'plantão', valor: '1133334444', label: 'Plantão 24h', principal: '0' },
      { tipo: 'whatsapp', subtipo: 'geral', valor: '11999998888', label: 'Atendimento geral', principal: '0' },
      { tipo: 'telefone', subtipo: 'emergência', valor: '0800123456', label: 'Emergência', principal: '0' },
      { tipo: 'email', subtipo: 'divulgação', valor: 'contato@cooperativa.coop.br', label: 'Divulgação institucional', principal: '0' },
      { tipo: 'telefone', subtipo: 'divulgação', valor: '1132104567', label: 'Divulgação telefone', principal: '0' },
      { tipo: 'whatsapp', subtipo: 'divulgação', valor: '11987654321', label: 'Divulgação WhatsApp', principal: '0' },
      { tipo: 'outro', subtipo: 'divulgação', valor: 'canal oficial', label: 'Divulgação outros canais', principal: '0' },
      { tipo: 'telefone', subtipo: 'comercial pf', valor: '11981234567', label: 'Comercial PF', principal: '0' },
      { tipo: 'telefone', subtipo: 'comercial pj', valor: '1131234567', label: 'Comercial PJ', principal: '0' },
    ],
  },
  {
    key: 'lgpd',
    title: 'LGPD',
    displayColumns: [
      { key: 'primeiro_nome', label: 'Nome' },
      { key: 'sobrenome', label: 'Sobrenome' },
      { key: 'email', label: 'Email' },
      { key: 'telefone', label: 'Telefone' },
    ],
    fields: [
      { key: 'primeiro_nome', label: 'Primeiro nome', type: 'text' },
      { key: 'sobrenome', label: 'Sobrenome', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'telefone', label: 'Telefone', type: 'text' },
      { key: 'ativo', label: 'Ativo', type: 'boolean' },
    ],
  },
  {
    key: 'ouvidores',
    title: 'Ouvidoria',
    displayColumns: [
      { key: 'primeiro_nome', label: 'Nome' },
      { key: 'sobrenome', label: 'Sobrenome' },
      { key: 'email', label: 'Email' },
      { key: 'telefone_fixo', label: 'Fixo' },
      { key: 'telefone_celular', label: 'Celular' },
    ],
    fields: [
      { key: 'primeiro_nome', label: 'Primeiro nome', type: 'text' },
      { key: 'sobrenome', label: 'Sobrenome', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'telefone_fixo', label: 'Telefone fixo', type: 'text' },
      { key: 'telefone_celular', label: 'Telefone celular', type: 'text' },
      { key: 'ativo', label: 'Ativo', type: 'boolean' },
    ],
  },
  {
    key: 'plantao',
    title: 'Urgência & Emergência',
    displayColumns: [
      { key: 'modelo_atendimento', label: 'Modelo' },
      { key: 'descricao', label: 'Descrição' },
    ],
    fields: [
      { key: 'modelo_atendimento', label: 'Modelo de atendimento', type: 'text' },
      { key: 'descricao', label: 'Descrição', type: 'textarea' },
      { key: 'ativo', label: 'Ativo', type: 'boolean' },
    ],
  },
];

const toBool = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = (value ?? '').toString().toLowerCase().trim();
  return ['1', 'true', 't', 'yes', 'y', 'sim'].includes(s);
};

const toNumberOrNull = (value: unknown) => {
  const s = (value ?? '').toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const formatEnumLabel = (fieldKey: string, value: unknown) => {
  const s = String(value ?? '').trim();
  if (!s) return s;
  const norm = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (fieldKey === 'tipo') {
    const map: Record<string, string> = {
      email: 'E-mail',
      telefone: 'Telefone',
      whatsapp: 'WhatsApp',
      outro: 'Outro',
      fiscal: 'Fiscal',
      administrativo: 'Administrativo',
      tecnico: 'Técnico',
      sede: 'Correspondência',
      filial: 'Filial',
      atendimento: 'Atendimento',
      correspondencia: 'Correspondência',
    };
    return map[norm] ?? s;
  }

  if (fieldKey === 'subtipo') {
    const map: Record<string, string> = {
      lgpd: 'LGPD',
      plantao: 'Plantão',
      geral: 'Geral',
      emergencia: 'Emergência',
      divulgacao: 'Divulgação',
      'comercial pf': 'Comercial PF',
      'comercial pj': 'Comercial PJ',
    };
    return map[norm] ?? s;
  }

  if (fieldKey === 'posicao') {
    const map: Record<string, string> = {
      titular: 'Titular',
      suplente: 'Suplente',
    };
    return map[norm] ?? s;
  }

  return s;
};

const formatCell = (value: unknown, fieldKey?: string) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'string' && (value === '0' || value === '1')) return value === '1' ? 'Sim' : 'Não';
  if (fieldKey) return formatEnumLabel(fieldKey, value);
  return String(value);
};

const onlyDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

const maskPhone = (value: unknown) => {
  const digits = onlyDigits(value);
  if (!digits) return '';
  if (digits.startsWith('0800')) {
    const base = digits.slice(0, 11);
    if (base.length <= 4) return base;
    if (base.length <= 7) return `${base.slice(0, 4)} ${base.slice(4)}`;
    return `${base.slice(0, 4)} ${base.slice(4, 7)} ${base.slice(7, 11)}`;
  }
  if (digits.length <= 10) {
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const maskCpf = (value: unknown) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

const maskCnpj = (value: unknown) => {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

const normalizeKey = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const isPhoneField = (fieldKey: string) => ['telefone', 'telefone_fixo', 'telefone_celular'].includes(fieldKey);

const isStandardizedField = (fieldKey: string, def?: ResourceDef) => {
  const normalized = normalizeKey(fieldKey);
  if (['tipo', 'subtipo', 'posicao'].includes(normalized)) return true;
  if (!def) return false;
  return def.fields.some((field) => field.key === fieldKey && field.type === 'select');
};

const getBadgeToneClass = (fieldKey: string, value: unknown) => {
  const key = normalizeKey(fieldKey);
  const val = normalizeKey(value);

  if (key === 'tipo') {
    const map: Record<string, string> = {
      email: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      telefone: 'bg-sky-50 text-sky-700 border-sky-200',
      whatsapp: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      outro: 'bg-slate-100 text-slate-700 border-slate-200',
      fiscal: 'bg-violet-50 text-violet-700 border-violet-200',
      administrativo: 'bg-blue-50 text-blue-700 border-blue-200',
      tecnico: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      correspondencia: 'bg-teal-50 text-teal-700 border-teal-200',
      filial: 'bg-amber-50 text-amber-700 border-amber-200',
      atendimento: 'bg-lime-50 text-lime-700 border-lime-200',
    };
    return map[val] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  }

  if (key === 'subtipo') {
    const map: Record<string, string> = {
      lgpd: 'bg-rose-50 text-rose-700 border-rose-200',
      plantao: 'bg-amber-50 text-amber-700 border-amber-200',
      emergencia: 'bg-red-50 text-red-700 border-red-200',
      geral: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      divulgacao: 'bg-blue-50 text-blue-700 border-blue-200',
      'comercial pf': 'bg-violet-50 text-violet-700 border-violet-200',
      'comercial pj': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    };
    return map[val] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  }

  if (key === 'posicao') {
    return val === 'titular'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-sky-50 text-sky-700 border-sky-200';
  }

  return 'bg-slate-100 text-slate-700 border-slate-200';
};

function buildTemplateCsv(def: ResourceDef) {
  // "ativo" é controlado pelo sistema; não exigir no CSV.
  const cols = def.fields
    .map((f) => f.key)
    .filter((k) => k !== 'ativo')
    // Endereços: cidade/UF são preenchidos automaticamente a partir do código IBGE.
    .filter((k) => !(def.key === 'enderecos' && (k === 'cidade' || k === 'uf')));
  const escapeCsv = (value: unknown) => {
    const s = String(value ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(',')];
  for (const row of def.templateExamples ?? []) {
    lines.push(cols.map((c) => escapeCsv(row[c] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function downloadTextFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type AuxRow = Record<string, any> & { id: string };

const applyInputMask = (fieldKey: string, value: string, row?: AuxRow) => {
  const normalizedField = normalizeKey(fieldKey);
  if (normalizedField.includes('cpf')) return maskCpf(value);
  if (normalizedField.includes('cnpj')) return maskCnpj(value);
  if (isPhoneField(normalizedField)) return maskPhone(value);
  if (normalizedField === 'valor' && row && ['telefone', 'whatsapp'].includes(normalizeKey(row.tipo))) {
    return maskPhone(value);
  }
  return value;
};

const formatDisplayValue = (value: unknown, fieldKey: string, row?: AuxRow, def?: ResourceDef) => {
  const normalizedField = normalizeKey(fieldKey);
  if (normalizedField === 'telefone_celular' && row && toBool(row.telefone_celular_restrito)) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700">
        <Shield className="h-3.5 w-3.5" />
        Protegido
      </span>
    );
  }
  if (normalizedField === 'principal') {
    return toBool(value) ? <Check className="h-4 w-4 text-emerald-600" aria-label="Principal" /> : '';
  }
  if (normalizedField === 'divulgar_celular') {
    return toBool(value) ? <Check className="h-4 w-4 text-emerald-600" aria-label="Divulgação ativa" /> : '';
  }
  if (normalizedField === 'ativo') {
    return toBool(value)
      ? <Check className="h-4 w-4 text-emerald-600" aria-label="Ativo" />
      : <X className="h-4 w-4 text-red-500" aria-label="Inativo" />;
  }
  if (normalizedField.includes('cpf')) return maskCpf(value);
  if (normalizedField.includes('cnpj')) return maskCnpj(value);
  if (isPhoneField(normalizedField)) return maskPhone(value);
  if (normalizedField === 'valor' && row && ['telefone', 'whatsapp'].includes(normalizeKey(row.tipo))) {
    return maskPhone(value);
  }
  if (isStandardizedField(fieldKey, def)) {
    const label = formatCell(value, fieldKey);
    return (
      <Badge
        variant="outline"
        className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', getBadgeToneClass(fieldKey, value))}
      >
        {label}
      </Badge>
    );
  }
  return formatCell(value, fieldKey);
};

type CooperativaAuxiliaresTabProps = {
  idSingular: string;
  canEdit: boolean;
  resourceKey?: string;
};

export function CooperativaAuxiliaresTab({ idSingular, canEdit, resourceKey }: CooperativaAuxiliaresTabProps) {
  const { user } = useAuth();
  const [internalActiveKey, setInternalActiveKey] = useState<string>(RESOURCES[0].key);
  const [data, setData] = useState<Record<string, AuxRow[]>>({});
  const [, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const [editing, setEditing] = useState<{ key: string; row: AuxRow | null } | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, unknown>[]>([]);
  const [importError, setImportError] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [subtipoFilter, setSubtipoFilter] = useState<'all' | string>('all');
  const [phoneRequestError, setPhoneRequestError] = useState('');
  const [phoneRequests, setPhoneRequests] = useState<DiretorPhoneAccessRequest[]>([]);
  const [isLoadingPhoneRequests, setIsLoadingPhoneRequests] = useState(false);
  const [requestingDirectorId, setRequestingDirectorId] = useState<string | null>(null);
  const [processingPhoneRequestId, setProcessingPhoneRequestId] = useState<string | null>(null);

  const defs = useMemo(() => new Map(RESOURCES.map((r) => [r.key, r])), []);
  const activeKey = resourceKey && defs.has(resourceKey) ? resourceKey : internalActiveKey;
  const activeDef = defs.get(activeKey)!;
  const rows = data[activeKey] ?? [];
  const subtipoField = activeDef.fields.find((field) => field.key === 'subtipo');
  const subtipoOptions = subtipoField?.options ?? [];

  const filteredRows = useMemo(() => {
    const query = normalizeKey(searchTerm);
    return rows.filter((row) => {
      if (activeKey === 'contatos' && subtipoFilter !== 'all' && normalizeKey(row.subtipo) !== subtipoFilter) {
        return false;
      }

      if (!query) return true;

      return activeDef.displayColumns.some((col) => {
        const raw = row[col.key];
        const formatted = formatDisplayValue(raw, col.key, row, activeDef);
        const asText = typeof formatted === 'string' ? formatted : String(raw ?? '');
        return normalizeKey(asText).includes(query);
      });
    });
  }, [activeDef.displayColumns, activeKey, rows, searchTerm, subtipoFilter]);

  const canModerateDiretorPhoneRequests = useMemo(
    () => activeKey === 'diretores' && user?.papel === 'admin' && user?.cooperativa_id === idSingular,
    [activeKey, idSingular, user?.cooperativa_id, user?.papel],
  );

  const load = useCallback(async (key: string) => {
    try {
      setLoadingKey(key);
      setError('');
      const items = await apiService.getCooperativaAux<AuxRow>(idSingular, key);
      setData((prev) => ({ ...prev, [key]: Array.isArray(items) ? items : [] }));
    } catch (e) {
      console.error('Erro ao carregar aux:', e);
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados auxiliares');
    } finally {
      setLoadingKey(null);
    }
  }, [idSingular]);

  const ensureLoaded = useCallback(async (key: string) => {
    if (data[key]) return;
    await load(key);
  }, [data, load]);

  const openCreate = async (key: string) => {
    await ensureLoaded(key);
    setEditing({ key, row: null });
    const base: Record<string, any> = {};
    for (const f of defs.get(key)!.fields) {
      if (f.type === 'boolean') base[f.key] = f.key === 'divulgar_celular' ? false : true;
      else base[f.key] = '';
    }
    setDraft(base);
  };

  const openEdit = (key: string, row: AuxRow) => {
    setEditing({ key, row });
    const base: Record<string, any> = {};
    for (const f of defs.get(key)!.fields) {
      base[f.key] = row[f.key] ?? (f.type === 'boolean' ? (f.key === 'divulgar_celular' ? false : true) : '');
    }
    setDraft(base);
  };

  const save = async () => {
    if (!editing) return;
    const def = defs.get(editing.key)!;

    const payload: Record<string, unknown> = {};
    for (const f of def.fields) {
      const v = draft[f.key];
      if (f.type === 'boolean') payload[f.key] = toBool(v);
      else if (f.type === 'number') payload[f.key] = toNumberOrNull(v);
      else payload[f.key] = (v ?? '').toString();
    }

    try {
      setError('');
      if (editing.row) {
        await apiService.updateCooperativaAuxItem(idSingular, editing.key, editing.row.id, payload);
      } else {
        await apiService.createCooperativaAuxItem(idSingular, editing.key, payload);
      }
      setEditing(null);
      await load(editing.key);
    } catch (e) {
      console.error('Erro ao salvar aux:', e);
      setError(e instanceof Error ? e.message : 'Erro ao salvar registro');
    }
  };

  const remove = async (key: string, row: AuxRow) => {
    if (!canEdit) return;
    const ok = window.confirm('Remover este registro?');
    if (!ok) return;
    try {
      setError('');
      await apiService.deleteCooperativaAuxItem(idSingular, key, row.id);
      await load(key);
    } catch (e) {
      console.error('Erro ao remover aux:', e);
      setError(e instanceof Error ? e.message : 'Erro ao remover registro');
    }
  };

  const handleImportFile = async (file: File | null) => {
    setImportFile(file);
    setImportError('');
    setImportPreview([]);
    if (!file) return;
    try {
      const parsed = stripImportFields(await parseTabularFile(file));
      setImportPreview(parsed.slice(0, 50));
    } catch (e) {
      console.error('Erro parse import:', e);
      setImportError(e instanceof Error ? e.message : 'Erro ao ler arquivo');
    }
  };

  const doImport = async () => {
    if (!importFile) return;
    try {
      setImporting(true);
      setImportError('');
      const parsed = stripImportFields(await parseTabularFile(importFile));
      await apiService.importCooperativaAux(idSingular, activeKey, parsed as any, 'replace');
      setImportOpen(false);
      setImportFile(null);
      setImportPreview([]);
      await load(activeKey);
    } catch (e) {
      console.error('Erro import aux:', e);
      setImportError(e instanceof Error ? e.message : 'Erro ao importar');
    } finally {
      setImporting(false);
    }
  };

  const loadDiretorPhoneRequests = useCallback(async () => {
    if (!canModerateDiretorPhoneRequests) {
      setPhoneRequests([]);
      return;
    }
    try {
      setIsLoadingPhoneRequests(true);
      setPhoneRequestError('');
      const pending = await apiService.getDiretorPhoneAccessRequests(idSingular, 'pending');
      setPhoneRequests(pending);
    } catch (e) {
      const status = Number((e as any)?.status || 0);
      if (status === 403) {
        setPhoneRequests([]);
        return;
      }
      console.error('Erro ao carregar solicitações de celular dos diretores:', e);
      setPhoneRequestError(e instanceof Error ? e.message : 'Erro ao carregar solicitações');
    } finally {
      setIsLoadingPhoneRequests(false);
    }
  }, [canModerateDiretorPhoneRequests, idSingular]);

  const requestDiretorPhone = async (row: AuxRow) => {
    const diretorId = String(row.id || '');
    if (!diretorId) return;
    const nomeDiretor = [row.primeiro_nome, row.sobrenome].filter(Boolean).join(' ').trim() || 'diretor';
    const motivo = window.prompt(`Informe o motivo do acesso ao celular de ${nomeDiretor} (opcional):`) || '';
    try {
      setRequestingDirectorId(diretorId);
      setPhoneRequestError('');
      await apiService.requestDiretorPhoneAccess(idSingular, diretorId, motivo.trim() || undefined);
      await load(activeKey);
      if (canModerateDiretorPhoneRequests) {
        await loadDiretorPhoneRequests();
      }
    } catch (e) {
      console.error('Erro ao solicitar acesso ao celular do diretor:', e);
      setPhoneRequestError(e instanceof Error ? e.message : 'Erro ao solicitar contato');
    } finally {
      setRequestingDirectorId(null);
    }
  };

  const approveDiretorPhoneRequest = async (requestId: string) => {
    try {
      setProcessingPhoneRequestId(requestId);
      setPhoneRequestError('');
      await apiService.approveDiretorPhoneAccessRequest(idSingular, requestId);
      await loadDiretorPhoneRequests();
      await load(activeKey);
    } catch (e) {
      console.error('Erro ao aprovar solicitação de celular:', e);
      setPhoneRequestError(e instanceof Error ? e.message : 'Erro ao aprovar solicitação');
    } finally {
      setProcessingPhoneRequestId(null);
    }
  };

  const rejectDiretorPhoneRequest = async (requestId: string) => {
    const notes = window.prompt('Informe o motivo da rejeição (opcional):') || '';
    try {
      setProcessingPhoneRequestId(requestId);
      setPhoneRequestError('');
      await apiService.rejectDiretorPhoneAccessRequest(idSingular, requestId, notes.trim() || undefined);
      await loadDiretorPhoneRequests();
      await load(activeKey);
    } catch (e) {
      console.error('Erro ao rejeitar solicitação de celular:', e);
      setPhoneRequestError(e instanceof Error ? e.message : 'Erro ao rejeitar solicitação');
    } finally {
      setProcessingPhoneRequestId(null);
    }
  };

  // lazy load
  useEffect(() => {
    void ensureLoaded(activeKey);
  }, [activeKey, ensureLoaded]);

  useEffect(() => {
    setSearchTerm('');
    setSubtipoFilter('all');
    setPhoneRequestError('');
  }, [activeKey]);

  useEffect(() => {
    if (activeKey === 'diretores') {
      void loadDiretorPhoneRequests();
    } else {
      setPhoneRequests([]);
    }
  }, [activeKey, loadDiretorPhoneRequests]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {!resourceKey && (
        <div className="flex flex-wrap gap-2">
          {RESOURCES.map((r) => (
            <Button
              key={r.key}
              variant={activeKey === r.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInternalActiveKey(r.key)}
            >
              {r.title}
            </Button>
          ))}
        </div>
      )}

      <Card className="relative">
        <CardHeader className="pr-36">
          <div>
            <CardTitle className="text-base">{activeDef.title}</CardTitle>
            {activeDef.description && <p className="text-sm text-gray-500">{activeDef.description}</p>}
          </div>
          <div className="absolute right-6 top-6 flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              title="Baixar template CSV"
              aria-label="Baixar template CSV"
              className="aux-toolbar-icon-btn border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              onClick={() => downloadTextFile(`${activeDef.key}_template.csv`, buildTemplateCsv(activeDef))}
            >
              <Download className="h-4 w-4" />
            </Button>

            <Dialog open={importOpen} onOpenChange={(open) => {
              setImportOpen(open);
              if (!open) {
                setImportFile(null);
                setImportPreview([]);
                setImportError('');
              }
            }}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  title="Importar"
                  aria-label="Importar"
                  className="aux-toolbar-icon-btn border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                  disabled={!canEdit}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Importar {activeDef.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Arquivo</Label>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
                    />
                    <p className="text-xs text-gray-500">
                      Use o template CSV para os nomes de colunas. Códigos numéricos (CPF/CNPJ/telefones/IBGE) devem ser enviados apenas com números. A importação substitui os registros desta cooperativa.
                    </p>
                    {importError && <p className="text-sm text-red-600">{importError}</p>}
                  </div>

                  {importPreview.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-900">Prévia (primeiras 50 linhas)</div>
                      <div className="max-h-64 overflow-auto border border-gray-200 rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {Object.keys(importPreview[0] ?? {}).slice(0, 8).map((k) => (
                                <TableHead key={k}>{k}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importPreview.slice(0, 10).map((row, idx) => (
                              <TableRow key={idx}>
                                {Object.keys(importPreview[0] ?? {}).slice(0, 8).map((k) => (
                                  <TableCell key={k}>{formatDisplayValue((row as any)[k], k, row as AuxRow, activeDef)}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cancelar</Button>
                    <Button onClick={doImport} disabled={!importFile || importing || !canEdit}>
                      {importing ? 'Importando...' : 'Importar (substituir)'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={!!editing} onOpenChange={(open) => {
              if (!open) setEditing(null);
            }}>
              <DialogTrigger asChild>
                <Button
                  size="icon"
                  title="Adicionar"
                  aria-label="Adicionar"
                  className="aux-toolbar-icon-btn shadow-sm"
                  onClick={() => openCreate(activeKey)}
                  disabled={!canEdit}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>
                    {editing?.row ? 'Editar registro' : 'Novo registro'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {editing && defs.get(editing.key)!.fields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label>{f.label}</Label>
                      {f.type === 'textarea' ? (
                        <Textarea
                          value={draft[f.key] ?? ''}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      ) : f.type === 'select' ? (
                        <select
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={draft[f.key] ?? ''}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        >
                          <option value="">Selecione...</option>
                          {(f.options ?? []).map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : f.type === 'boolean' ? (
                        <select
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={toBool(draft[f.key]) ? '1' : '0'}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.value === '1' }))}
                        >
                          <option value="1">Sim</option>
                          <option value="0">Não</option>
                        </select>
                      ) : (
                        <Input
                          type={f.type === 'number' ? 'number' : 'text'}
                          value={draft[f.key] ?? ''}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: applyInputMask(f.key, e.target.value, prev as AuxRow) }))}
                        />
                      )}
                    </div>
                  ))}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                    <Button onClick={save} disabled={!canEdit}>Salvar</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {phoneRequestError && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              {phoneRequestError}
            </div>
          )}

          {canModerateDiretorPhoneRequests && (
            <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 text-sm font-semibold text-gray-900">Solicitações de acesso ao celular (LGPD)</div>
              {isLoadingPhoneRequests ? (
                <p className="text-sm text-gray-500">Carregando solicitações...</p>
              ) : phoneRequests.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma solicitação pendente.</p>
              ) : (
                <div className="space-y-2">
                  {phoneRequests.map((request) => (
                    <div key={request.id} className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">{request.requester_nome} ({request.requester_email})</p>
                        <p className="text-gray-600">Diretor: {request.diretor_nome}{request.diretor_cargo ? ` • ${request.diretor_cargo}` : ''}</p>
                        {request.motivo && <p className="text-gray-500">Motivo: {request.motivo}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveDiretorPhoneRequest(request.id)}
                          disabled={processingPhoneRequestId === request.id}
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectDiretorPhoneRequest(request.id)}
                          disabled={processingPhoneRequestId === request.id}
                        >
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar na tabela..."
                className="h-9 rounded-full pl-9"
              />
            </div>
            {activeKey === 'contatos' && (
              <select
                className="h-9 rounded-full border border-input bg-background px-3 text-sm sm:w-52"
                value={subtipoFilter}
                onChange={(e) => setSubtipoFilter(e.target.value)}
              >
                <option value="all">Todos os subtipos</option>
                {subtipoOptions.map((opt) => (
                  <option key={opt.value} value={normalizeKey(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {activeDef.displayColumns.map((col) => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={activeDef.displayColumns.length + 1} className="text-center text-gray-500 py-10">
                      Nenhum registro cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      {activeDef.displayColumns.map((col) => (
                        <TableCell key={col.key}>{formatDisplayValue(row[col.key], col.key, row, activeDef)}</TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {activeKey === 'diretores' && toBool(row.telefone_celular_restrito) && toBool(row.pode_solicitar_celular) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => requestDiretorPhone(row)}
                              disabled={requestingDirectorId === row.id || row.celular_request_status === 'pending'}
                            >
                              {row.celular_request_status === 'pending' ? 'Solicitado' : 'Solicitar celular'}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openEdit(activeKey, row)} disabled={!canEdit}>
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => remove(activeKey, row)} disabled={!canEdit}>
                            Remover
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
