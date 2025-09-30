import type { Cooperativa } from '../types';

type BaseRole = 'operador' | 'admin';

const normalizeBaseRole = (role: string | null | undefined): BaseRole => {
  if (!role) return 'operador';
  const value = role.toLowerCase();
  return value === 'admin' ? 'admin' : 'operador';
};

const resolveRoleForCooperativa = (baseRole: BaseRole, cooperativa?: Pick<Cooperativa, 'tipo'> | null) => {
  if (baseRole === 'admin') return 'admin' as const;
  const tipo = cooperativa?.tipo;
  if (tipo === 'CONFEDERACAO') return 'confederacao' as const;
  if (tipo === 'FEDERACAO') return 'federacao' as const;
  return 'operador' as const;
};

export const deriveRole = (
  role: string | null | undefined,
  cooperativa?: Pick<Cooperativa, 'tipo'> | null,
) => {
  const base = normalizeBaseRole(role);
  return resolveRoleForCooperativa(base, cooperativa);
};

export const toBaseRole = (role: string | null | undefined): BaseRole => {
  return normalizeBaseRole(role);
};

export const describeRole = (role: string | null | undefined) => {
  switch ((role || '').toLowerCase()) {
    case 'confederacao':
      return 'Operador - Confederação';
    case 'federacao':
      return 'Operador - Federação';
    case 'admin':
      return 'Administrador';
    default:
      return 'Operador';
  }
};
