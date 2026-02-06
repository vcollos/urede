import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/apiService';
import type { Cidade } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Search, MapPinned } from 'lucide-react';

export function CidadesView() {
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchCidades = async () => {
      try {
        setIsLoading(true);
        const data = await apiService.getCidades();
        setCidades(data);
      } catch (err) {
        console.error('Erro ao carregar cidades:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar cidades');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCidades();
  }, []);

  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const filtered = useMemo(() => {
    if (!searchTerm) return cidades;
    const query = normalize(searchTerm);
    return cidades.filter((cidade) => {
      const tokens = [
        cidade.nm_cidade,
        cidade.cd_municipio_7,
        cidade.cd_municipio,
        cidade.uf_municipio,
        cidade.nm_regiao,
        cidade.regional_saude,
        cidade.id_singular,
        cidade.nm_singular,
        cidade.reg_ans,
      ]
        .filter(Boolean)
        .map((value) => normalize(String(value)));
      return tokens.some((token) => token.includes(query));
    });
  }, [cidades, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
          <MapPinned className="w-5 h-5" />
          Cidades cadastradas
        </h1>
        <p className="text-gray-600 dark:text-slate-400">
          Consulte a base de municípios com vínculo às cooperativas.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-slate-100">Panorama das cidades</CardTitle>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar por nome, código ou UF..."
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-gray-500 dark:text-slate-400">
              Carregando cidades...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-600">{error}</div>
          ) : (
            <ScrollArea className="max-h-[65vh]">
              <div className="min-w-[720px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Município</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Código IBGE (7)</TableHead>
                      <TableHead>Código IBGE</TableHead>
                      <TableHead>Regional de Saúde</TableHead>
                      <TableHead>Região</TableHead>
                      <TableHead>Habitantes</TableHead>
                      <TableHead>Singular</TableHead>
                      <TableHead>Cooperativa (ID)</TableHead>
                      <TableHead>Reg. ANS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-6 text-center text-gray-500 dark:text-slate-400">
                          Nenhuma cidade encontrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((cidade) => (
                        <TableRow key={cidade.cd_municipio_7}>
                          <TableCell className="font-medium text-gray-900 dark:text-slate-100">
                            {cidade.nm_cidade}
                          </TableCell>
                          <TableCell>{cidade.uf_municipio}</TableCell>
                          <TableCell>{cidade.cd_municipio_7}</TableCell>
                          <TableCell>{cidade.cd_municipio || '—'}</TableCell>
                          <TableCell>{cidade.regional_saude || '—'}</TableCell>
                          <TableCell>{cidade.nm_regiao || '—'}</TableCell>
                          <TableCell>{cidade.cidades_habitantes?.toLocaleString('pt-BR') ?? '—'}</TableCell>
                          <TableCell>{cidade.nm_singular || '—'}</TableCell>
                          <TableCell>{cidade.id_singular || '—'}</TableCell>
                          <TableCell>{cidade.reg_ans || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
