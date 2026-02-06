type BaseRole = 'operador' | 'admin';

const normalizeBaseRole = (role: string | null | undefined): BaseRole => {
  if (!role) return 'operador';
  const value = role.toLowerCase();
  return value === 'admin' ? 'admin' : 'operador';
};

export const deriveRole = (role: string | null | undefined) => {
  return normalizeBaseRole(role);
};

export const toBaseRole = (role: string | null | undefined): BaseRole => {
  return normalizeBaseRole(role);
};

export const describeRole = (role: string | null | undefined) => {
  switch ((role || '').toLowerCase()) {
    case 'admin':
      return 'Administrador';
    default:
      return 'Operador';
  }
};
