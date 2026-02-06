import { useState } from 'react';
import { apiService } from '../services/apiService';
import type { PrestadorRecord } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Search } from 'lucide-react';

const getFirstField = (record: PrestadorRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

export function PrestadoresView() {
  const [source, setSource] = useState<'prestadores' | 'prestadores_ans'>('prestadores');
  const [searchTerm, setSearchTerm] = useState('');
  const [regAns, setRegAns] = useState('');
  const [results, setResults] = useState<PrestadorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const fetchProviders = async (nextOffset = 0, append = false) => {
    try {
      setIsLoading(true);
      setError('');
      const params = {
        q: searchTerm.trim() || undefined,
        reg_ans: regAns.trim() || undefined,
        limit,
        offset: nextOffset,
      };
      const data = source === 'prestadores'
        ? await apiService.getPrestadores(params)
        : await apiService.getPrestadoresAns(params);
      setResults((prev) => (append ? [...prev, ...data] : data));
      setOffset(nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar prestadores');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void fetchProviders(0, false);
  };

  const handleLoadMore = () => {
    void fetchProviders(offset + limit, true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
          <Search className="w-5 h-5" />
          Prestadores
        </h1>
        <p className="text-gray-600 dark:text-slate-400">
          Pesquisa publica na base de prestadores (ANS e cadastro enriquecido).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">Filtros de busca</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-gray-700">Termo de busca</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Nome, razao social, cidade..."
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48 space-y-2">
              <label className="text-sm font-medium text-gray-700">Reg. ANS</label>
              <Input
                value={regAns}
                onChange={(event) => setRegAns(event.target.value)}
                placeholder="0000"
              />
            </div>
            <div className="w-full md:w-48 space-y-2">
              <label className="text-sm font-medium text-gray-700">Fonte</label>
              <Select value={source} onValueChange={(value) => setSource(value as 'prestadores' | 'prestadores_ans')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prestadores">Cadastro enriquecido</SelectItem>
                  <SelectItem value="prestadores_ans">Base ANS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Buscando...' : 'Buscar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-900">
            Resultados {results.length > 0 ? `(${results.length})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {isLoading && results.length === 0 ? (
            <div className="text-sm text-gray-500">Carregando prestadores...</div>
          ) : results.length === 0 ? (
            <div className="text-sm text-gray-500">Nenhum prestador encontrado.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {results.map((record, index) => {
                const title =
                  getFirstField(record, ['nome_fantasia', 'nome', 'razao_social', 'fantasia', 'nm_prestador', 'nome_prestador']) ||
                  'Prestador';
                const cidade = getFirstField(record, ['cidade', 'municipio', 'nm_municipio', 'cidade_nome']);
                const uf = getFirstField(record, ['uf', 'uf_municipio']);
                const regAnsValue = getFirstField(record, ['reg_ans', 'registro_ans']);
                const cnpj = getFirstField(record, ['cnpj', 'cnpj_padrao']);
                const especialidade = getFirstField(record, ['especialidade', 'especialidades']);
                return (
                  <div key={`${title}-${index}`} className="rounded-lg border border-gray-200 p-4 space-y-2 bg-white">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-gray-900">{formatValue(title)}</h3>
                      {(cidade || uf) && (
                        <p className="text-sm text-gray-500">
                          {formatValue(cidade)} {uf ? `• ${formatValue(uf)}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {regAnsValue && <Badge variant="outline">Reg. ANS: {formatValue(regAnsValue)}</Badge>}
                      {cnpj && <Badge variant="outline">CNPJ: {formatValue(cnpj)}</Badge>}
                      {especialidade && <Badge variant="outline">Especialidade: {formatValue(especialidade)}</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {results.length >= limit && !isLoading && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleLoadMore}>
                Carregar mais
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
