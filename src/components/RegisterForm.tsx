import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { Cooperativa } from '../types';
import { deriveRole, toBaseRole } from '../utils/roleMapping';

interface RegisterFormProps {
  onToggleMode: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onToggleMode }) => {
  const [formData, setFormData] = useState({
    nome: '',
    display_name: '',
    email: '',
    telefone: '',
    whatsapp: '',
    cargo: '',
    password: '',
    cooperativa_id: '',
    papel: 'operador' as 'operador' | 'admin'
  });
  const [cooperativas, setCooperativas] = useState<Cooperativa[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCoops, setIsLoadingCoops] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');

  const { register } = useAuth();

  // Carregar cooperativas
  useEffect(() => {
    const loadCooperativas = async () => {
      try {
        // Usar API pública para carregar cooperativas durante o registro
        const cooperativasData = await apiService.getCooperativasPublic();
        setCooperativas(cooperativasData);
      } catch (err) {
        console.error('Erro ao carregar cooperativas:', err);
        // Fallback para dados estáticos em caso de erro
        const cooperativasFallback: Cooperativa[] = [
          {
            id_singular: 'SING001',
            singular: 'Uniodonto São Paulo',
            uniodonto: 'Uniodonto São Paulo',
            cnpj_padrao: '12.345.678/0001-01',
            cnpj: '12.345.678/0001-01',
            cro_operadora: 'CRO-SP',
            data_fundacao_padrao: '1995-03-15',
            data_fundacao: '1995-03-15',
            razao_social: 'Cooperativa Odontológica de São Paulo',
            raz_social: 'Cooperativa Odontológica de São Paulo',
            reg_ans: 'ANS-SP-001',
            codigo_ans: 'ANS-SP-001',
            federacao_id: 'FED001',
            federacao_nome: 'Uniodonto São Paulo',
            federacao: 'Uniodonto São Paulo',
            software: 'Sistema Próprio',
            papel_rede: 'SINGULAR',
            tipo: 'SINGULAR',
            op_pr: 'Operadora'
          },
          {
            id_singular: 'FED001',
            singular: 'Federação São Paulo',
            uniodonto: 'Federação São Paulo',
            cnpj_padrao: '98.765.432/0001-01',
            cnpj: '98.765.432/0001-01',
            cro_operadora: 'CRO-SP',
            data_fundacao_padrao: '1990-01-10',
            data_fundacao: '1990-01-10',
            razao_social: 'Federação das Cooperativas Odontológicas de São Paulo',
            raz_social: 'Federação das Cooperativas Odontológicas de São Paulo',
            reg_ans: 'ANS-SP-FED',
            codigo_ans: 'ANS-SP-FED',
            federacao_nome: 'Uniodonto São Paulo',
            federacao: 'Uniodonto São Paulo',
            software: 'Sistema Integrado',
            papel_rede: 'FEDERACAO',
            tipo: 'FEDERACAO',
            op_pr: 'Institucional'
          },
          {
            id_singular: 'CONF001',
            singular: 'Confederação Nacional',
            uniodonto: 'Confederação Nacional',
            cnpj_padrao: '11.222.333/0001-01',
            cnpj: '11.222.333/0001-01',
            cro_operadora: 'CFO',
            data_fundacao_padrao: '1985-05-20',
            data_fundacao: '1985-05-20',
            razao_social: 'Confederação Nacional das Cooperativas Odontológicas',
            raz_social: 'Confederação Nacional das Cooperativas Odontológicas',
            reg_ans: 'ANS-BR-CONF',
            codigo_ans: 'ANS-BR-CONF',
            federacao_nome: 'Nacional',
            federacao: 'Nacional',
            software: 'Sistema Nacional',
            papel_rede: 'CONFEDERACAO',
            tipo: 'CONFEDERACAO',
            op_pr: 'Institucional'
          }
        ];
        setCooperativas(cooperativasFallback);
        // Não exibir erro se conseguimos preencher via fallback
        setError('');
      } finally {
        setIsLoadingCoops(false);
      }
    };

    loadCooperativas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const papelFinal = deriveRole(formData.papel);

      const response = await register({
        ...formData,
        papel: papelFinal,
      });
      const autoApproveMessage = response?.autoApprove
        ? 'Confirme seu e-mail; sua conta será ativada automaticamente assim que a confirmação for concluída.'
        : 'Confirme seu e-mail; sua conta será encaminhada para aprovação.';
      setSuccessMessage(response?.message || autoApproveMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Cadastro - Sistema Uniodonto</CardTitle>
        <CardDescription>
          Crie sua conta para acessar o sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMessage && (
            <Alert>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              type="text"
              value={formData.nome}
              onChange={(e) => updateFormData('nome', e.target.value)}
              placeholder="Seu nome completo"
              required
              disabled={isSubmitting || !!successMessage}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="display_name">Nome de exibição</Label>
            <Input
              id="display_name"
              type="text"
              value={formData.display_name}
              onChange={(e) => updateFormData('display_name', e.target.value)}
              placeholder="Como você quer ser chamado"
              required
              disabled={isSubmitting || !!successMessage}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateFormData('email', e.target.value)}
              placeholder="seu.email@uniodonto.com.br"
              required
              disabled={isSubmitting || !!successMessage}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                value={formData.telefone}
                onChange={(e) => updateFormData('telefone', e.target.value)}
                placeholder="(11) 3333-4444"
                required
                disabled={isSubmitting || !!successMessage}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                value={formData.whatsapp}
                onChange={(e) => updateFormData('whatsapp', e.target.value)}
                placeholder="(11) 99999-8888"
                required
                disabled={isSubmitting || !!successMessage}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input
              id="cargo"
              type="text"
              value={formData.cargo}
              onChange={(e) => updateFormData('cargo', e.target.value)}
              placeholder="Ex: Coordenador de Credenciamento"
              required
              disabled={isSubmitting || !!successMessage}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => updateFormData('password', e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={isSubmitting || !!successMessage}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cooperativa">Cooperativa</Label>
            <Select 
              value={formData.cooperativa_id} 
              onValueChange={(value) => updateFormData('cooperativa_id', value)}
              required
              disabled={isSubmitting || isLoadingCoops || !!successMessage}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingCoops ? "Carregando..." : "Selecione sua cooperativa"} />
              </SelectTrigger>
              <SelectContent>
                {cooperativas.map((coop) => (
                  <SelectItem key={coop.id_singular} value={coop.id_singular}>
                    {(coop.singular || coop.uniodonto)} ({coop.papel_rede || coop.tipo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="papel">Papel no sistema</Label>
            <Select 
              value={formData.papel} 
              onValueChange={(value) => updateFormData('papel', toBaseRole(value))}
              required
              disabled={isSubmitting || !!successMessage}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione seu papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operador">Operador</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || isLoadingCoops || !!successMessage}
          >
            {isSubmitting ? 'Criando conta...' : 'Criar conta'}
          </Button>
          
          <div className="text-center space-y-2">
            <Button 
              type="button"
              variant="link"
              onClick={onToggleMode}
              className="text-sm"
            >
              Já tem uma conta? Faça login
            </Button>
            {successMessage && (
              <div className="text-xs text-gray-500">
                Clique em "Faça login" após confirmar o seu e-mail.
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
