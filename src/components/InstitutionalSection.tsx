import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/apiService';
import type { InstitutionalMeta, InstitutionalTable } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';

const DEFAULT_HIDDEN_COLUMNS = new Set(['created_at', 'updated_at', 'deleted_at']);

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const getPrimaryKey = (meta?: InstitutionalMeta | null) => meta?.primaryKeys?.[0] || 'id';

const getPlantaoLabel = (record: Record<string, unknown>) => {
  const candidates = [
    'nome',
    'descricao',
    'local',
    'tipo',
    'responsavel',
    'titulo',
    'observacao',
  ];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  const fallback = record.id || record.uuid || record.codigo;
  return fallback ? String(fallback) : 'Plantao';
};

interface InstitutionalSectionProps {
  table: InstitutionalTable;
  label: string;
  description?: string;
  cooperativaId: string;
  canEdit: boolean;
}

export function InstitutionalSection({ table, label, description, cooperativaId, canEdit }: InstitutionalSectionProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta] = useState<InstitutionalMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingRecord, setEditingRecord] = useState<Record<string, unknown> | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [plantaoRows, setPlantaoRows] = useState<Record<string, unknown>[]>([]);
  const [plantaoMeta, setPlantaoMeta] = useState<InstitutionalMeta | null>(null);

  const pkColumn = getPrimaryKey(meta);
  const plantaoPk = getPrimaryKey(plantaoMeta);
  const plantaoRefColumn = useMemo(() => {
    if (!meta) return null;
    if (meta.columns.includes('plantao_id')) return 'plantao_id';
    if (meta.columns.includes('cooperativa_plantao_id')) return 'cooperativa_plantao_id';
    return null;
  }, [meta]);

  const editableColumns = useMemo(() => {
    if (!meta) return [] as string[];
    return meta.columns.filter((column) => {
      if (column === pkColumn) return false;
      if (DEFAULT_HIDDEN_COLUMNS.has(column)) return false;
      if (column === 'cooperativa_id') return false;
      return true;
    });
  }, [meta, pkColumn]);

  const displayColumns = useMemo(() => {
    if (!meta) return [] as string[];
    return meta.columns.filter((column) => {
      if (DEFAULT_HIDDEN_COLUMNS.has(column)) return false;
      if (column === 'cooperativa_id') return false;
      return true;
    });
  }, [meta]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await apiService.getInstitucional(table, cooperativaId);
      setRows(Array.isArray(response?.rows) ? response.rows : []);
      setMeta(response?.meta ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlantoes = async () => {
    if (table !== 'plantao_horarios' && table !== 'plantao_telefones') return;
    try {
      const response = await apiService.getInstitucional('cooperativa_plantao', cooperativaId);
      setPlantaoRows(Array.isArray(response?.rows) ? response.rows : []);
      setPlantaoMeta(response?.meta ?? null);
    } catch {
      setPlantaoRows([]);
      setPlantaoMeta(null);
    }
  };

  useEffect(() => {
    if (!cooperativaId) return;
    void loadData();
    void loadPlantoes();
  }, [table, cooperativaId]);

  const openCreate = () => {
    const initial: Record<string, string> = {};
    editableColumns.forEach((column) => {
      initial[column] = '';
    });
    if (plantaoRefColumn && plantaoRows.length > 0) {
      const firstId = plantaoRows[0]?.[plantaoPk];
      initial[plantaoRefColumn] = firstId ? String(firstId) : '';
    }
    setEditingRecord(null);
    setFormValues(initial);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (record: Record<string, unknown>) => {
    const initial: Record<string, string> = {};
    editableColumns.forEach((column) => {
      const value = record[column];
      initial[column] = value === null || value === undefined ? '' : String(value);
    });
    setEditingRecord(record);
    setFormValues(initial);
    setFormError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!meta) return;
    setIsSaving(true);
    setFormError('');
    try {
      const record: Record<string, unknown> = {};
      Object.entries(formValues).forEach(([key, value]) => {
        if (value === '') return;
        record[key] = value;
      });
      if (plantaoRefColumn && !record[plantaoRefColumn]) {
        setFormError('Selecione um plantao valido antes de salvar.');
        setIsSaving(false);
        return;
      }
      if (meta.columns.includes('cooperativa_id') && !record.cooperativa_id) {
        record.cooperativa_id = cooperativaId;
      }

      if (editingRecord) {
        const id = editingRecord[pkColumn];
        if (!id) {
          setFormError('Registro invalido para atualizacao.');
          setIsSaving(false);
          return;
        }
        const updated = await apiService.updateInstitucional(table, String(id), record);
        setRows((prev) => prev.map((row) => (row[pkColumn] === id ? updated : row)));
      } else {
        const created = await apiService.createInstitucional(table, record);
        setRows((prev) => [...prev, created]);
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar dados');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (record: Record<string, unknown>) => {
    if (!meta) return;
    const id = record[pkColumn];
    if (!id) return;
    const confirmed = window.confirm('Tem certeza que deseja excluir este registro?');
    if (!confirmed) return;
    try {
      await apiService.deleteInstitucional(table, String(id));
      setRows((prev) => prev.filter((row) => row[pkColumn] !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir registro');
    }
  };

  const plantaoOptions = useMemo(() => {
    if (plantaoRows.length === 0) return [];
    return plantaoRows
      .map((row) => {
        const idValue = row[plantaoPk];
        if (idValue === null || idValue === undefined || idValue === '') return null;
        return {
          id: String(idValue),
          label: getPlantaoLabel(row),
        };
      })
      .filter((option): option is { id: string; label: string } => Boolean(option));
  }, [plantaoRows, plantaoPk]);

  const renderValue = (column: string, value: unknown) => {
    if (plantaoRefColumn && column === plantaoRefColumn) {
      const match = plantaoOptions.find((opt) => opt.id === String(value ?? ''));
      return match?.label || formatValue(value);
    }
    return formatValue(value);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-gray-900">{label}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={openCreate} disabled={isLoading || !meta}>
            Adicionar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {isLoading ? (
          <div className="text-sm text-gray-500">Carregando dados...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhum registro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {displayColumns.map((column) => (
                    <TableHead key={column}>{column.replace(/_/g, ' ')}</TableHead>
                  ))}
                  {canEdit && <TableHead className="w-28">Acoes</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={String(row[pkColumn] ?? Math.random())}>
                    {displayColumns.map((column) => (
                      <TableCell key={column}>{renderValue(column, row[column])}</TableCell>
                    ))}
                    {canEdit && (
                      <TableCell className="space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(row)}>
                          Excluir
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
        <DialogContent className="w-full max-w-[min(560px,calc(100dvw-2rem))] max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecord ? 'Editar registro' : 'Adicionar registro'}</DialogTitle>
            <DialogDescription>
              {editingRecord ? 'Atualize os campos necessarios.' : 'Preencha as informacoes para criar um novo registro.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {plantaoRefColumn && plantaoOptions.length === 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  Cadastre pelo menos um plantao antes de inserir telefones ou horarios.
                </AlertDescription>
              </Alert>
            )}
            {editableColumns.map((column) => {
              const value = formValues[column] ?? '';
              if (plantaoRefColumn && column === plantaoRefColumn) {
                return (
                  <div key={column} className="space-y-2">
                    <Label>{column.replace(/_/g, ' ')}</Label>
                    <Select
                      value={value}
                      onValueChange={(val) => setFormValues((prev) => ({ ...prev, [column]: val }))}
                      disabled={plantaoOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um plantao" />
                      </SelectTrigger>
                      <SelectContent>
                        {plantaoOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return (
                <div key={column} className="space-y-2">
                  <Label>{column.replace(/_/g, ' ')}</Label>
                  <Input
                    value={value}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, [column]: event.target.value }))}
                  />
                </div>
              );
            })}
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
