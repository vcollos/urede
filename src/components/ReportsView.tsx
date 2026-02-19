import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Download, Printer, RefreshCcw, Clock4, BarChart3, ListChecks } from 'lucide-react';
import { apiService } from '../services/apiService';
import type { ReportsOverview } from '../types';

const DEFAULT_RANGE_DAYS = 30;

const formatInputDate = (value: Date) => {
  const copy = new Date(value);
  const year = copy.getFullYear();
  const month = `${copy.getMonth() + 1}`.padStart(2, '0');
  const day = `${copy.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatNumber = (value: number | null | undefined, fraction = 0) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  });
};

const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = MINUTES_IN_HOUR * 24;
const MINUTES_IN_MONTH = MINUTES_IN_DAY * 30;

const pluralize = (value: number, singular: string, plural: string) =>
  `${value} ${value === 1 ? singular : plural}`;

const formatDuration = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  let remaining = Math.max(0, Math.floor(value));
  const months = Math.floor(remaining / MINUTES_IN_MONTH);
  remaining %= MINUTES_IN_MONTH;
  const days = Math.floor(remaining / MINUTES_IN_DAY);
  remaining %= MINUTES_IN_DAY;
  const hours = Math.floor(remaining / MINUTES_IN_HOUR);
  const minutes = remaining % MINUTES_IN_HOUR;
  const parts: string[] = [];
  if (months) parts.push(pluralize(months, 'mês', 'meses'));
  if (days) parts.push(pluralize(days, 'dia', 'dias'));
  if (hours) parts.push(pluralize(hours, 'hora', 'horas'));
  if (minutes || parts.length === 0) parts.push(pluralize(minutes, 'minuto', 'minutos'));
  return parts.join(' ');
};

const formatCooperativaLabel = (
  entry: ReportsOverview['responseByCooperativa'][number],
) => {
  if (entry.cooperativa_nome && entry.cooperativa_id) {
    return `${entry.cooperativa_nome} (${entry.cooperativa_id})`;
  }
  if (entry.cooperativa_nome) return entry.cooperativa_nome;
  if (entry.cooperativa_id) return entry.cooperativa_id;
  return 'Não atribuída';
};

const buildCsv = (report: ReportsOverview) => {
  const rows: string[][] = [];
  rows.push([`Período`, `${report.range.start} a ${report.range.end}`]);
  rows.push([]);
  rows.push(['Relatório de criação']);
  rows.push(['Data', 'Pedidos', 'Concluídos']);
  report.creationSeries.forEach((entry) => {
    rows.push([entry.date, String(entry.total), String(entry.concluidos)]);
  });
  rows.push([]);
  rows.push(['Resposta por cooperativa']);
  rows.push(['Cooperativa', 'Pedidos', 'Respondidos', 'Tempo médio (detalhado)']);
  report.responseByCooperativa.forEach((entry) => {
    rows.push([
      formatCooperativaLabel(entry),
      String(entry.total),
      String(entry.responded),
      formatDuration(entry.tempo_medio_min),
    ]);
  });
  rows.push([]);
  rows.push(['Status', 'Total']);
  Object.entries(report.statusBreakdown).forEach(([status, total]) => {
    rows.push([status, String(total)]);
  });
  rows.push([]);
  rows.push(['Resumo', 'Valor']);
  rows.push(['Pedidos (total)', String(report.performanceSummary.totalPedidos)]);
  rows.push([
    'Tempo médio resposta',
    formatDuration(report.performanceSummary.mediaRespostaMin),
  ]);
  rows.push([
    'Tempo médio conclusão',
    formatDuration(report.performanceSummary.mediaConclusaoMin),
  ]);

  return rows
    .map((row) =>
      row
        .map((field) => {
          const safe = field.replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(','),
    )
    .join('\n');
};

const exportCsv = (report: ReportsOverview) => {
  const csv = buildCsv(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `relatorio-urede-${report.range.start}_a_${report.range.end}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const exportPdf = (report: ReportsOverview) => {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  const style = `
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
      th { background: #f4f4f4; }
      .section { margin-bottom: 32px; }
    </style>
  `;
  const creationRows = report.creationSeries
    .map((entry) =>
      `<tr><td>${entry.date}</td><td>${entry.total}</td><td>${entry.concluidos}</td></tr>`,
    )
    .join('');
  const responseRows = report.responseByCooperativa
    .map((entry) =>
      `<tr><td>${formatCooperativaLabel(entry)}</td><td>${entry.total}</td><td>${entry.responded}</td><td>${formatDuration(entry.tempo_medio_min)}</td></tr>`,
    )
    .join('');
  const statusRows = Object.entries(report.statusBreakdown)
    .map(([status, total]) => `<tr><td>${status}</td><td>${total}</td></tr>`)
    .join('');
  win.document.write(`
    <html>
      <head>
        <title>Relatório URede (${report.range.start} a ${report.range.end})</title>
        ${style}
      </head>
      <body>
        <h1>Relatório URede</h1>
        <p>Período: ${report.range.start} a ${report.range.end}</p>
        <div class="section">
          <h2>Criação de pedidos</h2>
          <table>
            <thead><tr><th>Data</th><th>Pedidos</th><th>Concluídos</th></tr></thead>
            <tbody>${creationRows}</tbody>
          </table>
        </div>
        <div class="section">
          <h2>Resposta por cooperativa</h2>
          <table>
            <thead><tr><th>Cooperativa</th><th>Total</th><th>Respondidos</th><th>Tempo médio</th></tr></thead>
            <tbody>${responseRows}</tbody>
          </table>
        </div>
        <div class="section">
          <h2>Status</h2>
          <table>
            <thead><tr><th>Status</th><th>Total</th></tr></thead>
            <tbody>${statusRows}</tbody>
          </table>
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
};

export function ReportsView() {
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (DEFAULT_RANGE_DAYS - 1));
    return {
      start: formatInputDate(start),
      end: formatInputDate(now),
    };
  });
  const [report, setReport] = useState<ReportsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiService.getReportsOverview(filters);
      setReport(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o relatório.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const statusEntries = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.statusBreakdown).map(([status, total]) => ({
      status,
      total,
    }));
  }, [report]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Relatórios e Dashboards</h1>
          <p className="text-sm text-gray-500">
            Gere relatórios por período e exporte os resultados para CSV ou PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!report || isLoading}
            onClick={() => report && exportCsv(report)}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!report || isLoading}
            onClick={() => report && exportPdf(report)}
          >
            <Printer className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Filtros rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4 md:flex-row md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void loadReport();
            }}
          >
            <div className="flex-1">
              <Label htmlFor="start">Data inicial</Label>
              <Input
                id="start"
                name="start"
                type="date"
                max={filters.end}
                value={filters.start}
                onChange={handleInputChange}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="end">Data final</Label>
              <Input
                id="end"
                name="end"
                type="date"
                min={filters.start}
                value={filters.end}
                onChange={handleInputChange}
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </form>
          {error && (
            <p className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      )}

      {!isLoading && report && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Pedidos</p>
                    <p className="text-2xl font-semibold">
                      {report.performanceSummary.totalPedidos}
                    </p>
                  </div>
                  <div className="rounded-full bg-purple-100 p-2 text-purple-600">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Tempo médio resposta</p>
                    <p className="text-2xl font-semibold">
                      {formatDuration(report.performanceSummary.mediaRespostaMin)}
                    </p>
                  </div>
                  <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                    <Clock4 className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Tempo médio conclusão</p>
                    <p className="text-2xl font-semibold">
                      {formatDuration(report.performanceSummary.mediaConclusaoMin)}
                    </p>
                  </div>
                  <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
                    <Clock4 className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Concluídos</p>
                    <p className="text-2xl font-semibold">
                      {report.performanceSummary.concluido}
                    </p>
                  </div>
                  <div className="rounded-full bg-green-100 p-2 text-green-600">
                    <ListChecks className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Criação de pedidos (por dia)</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Concluídos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.creationSeries.map((entry) => (
                      <TableRow key={entry.date}>
                        <TableCell className="font-medium">{entry.date}</TableCell>
                        <TableCell>{entry.total}</TableCell>
                        <TableCell>{entry.concluidos}</TableCell>
                      </TableRow>
                    ))}
                    {report.creationSeries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-gray-500">
                          Nenhum pedido encontrado no período selecionado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resposta por cooperativa responsável</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cooperativa</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Respondidos</TableHead>
                      <TableHead>Tempo médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.responseByCooperativa.map((entry, index) => (
                      <TableRow key={`${entry.cooperativa_id ?? 'none'}-${index}`}>
                        <TableCell className="font-medium">
                          {formatCooperativaLabel(entry)}
                        </TableCell>
                        <TableCell>{entry.total}</TableCell>
                        <TableCell>{entry.responded}</TableCell>
                        <TableCell>{formatDuration(entry.tempo_medio_min)}</TableCell>
                      </TableRow>
                    ))}
                    {report.responseByCooperativa.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                          Não há respostas registradas para este período.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Status dos pedidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statusEntries.map((entry) => (
                  <div key={entry.status} className="flex items-center justify-between">
                    <span className="font-medium capitalize">{entry.status.replace(/_/g, ' ')}</span>
                    <Badge variant="secondary">{entry.total}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Nível atual dos pedidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {['singular', 'federacao', 'confederacao'].map((nivel) => (
                  <div key={nivel} className="flex items-center justify-between">
                    <span className="font-medium capitalize">{nivel}</span>
                    <Badge variant="outline">{report.nivelResumo[nivel] ?? 0}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default ReportsView;
