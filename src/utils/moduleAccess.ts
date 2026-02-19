export type AppModuleAccess =
  | 'hub'
  | 'urede'
  | 'udocs'
  | 'umarketing'
  | 'ufast'
  | 'central_apps';

const ALLOWED_MODULES: AppModuleAccess[] = [
  'hub',
  'urede',
  'udocs',
  'umarketing',
  'ufast',
  'central_apps',
];

const normalizeLegacyModule = (value: string): AppModuleAccess | null => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const aliases: Record<string, AppModuleAccess> = {
    'central-apps': 'central_apps',
    'centralapps': 'central_apps',
    'central de apps': 'central_apps',
    'central_de_apps': 'central_apps',
  };

  const canonical = aliases[normalized] ?? normalized;
  if ((ALLOWED_MODULES as string[]).includes(canonical)) return canonical as AppModuleAccess;
  return null;
};

export const normalizeModuleAccess = (
  value: unknown,
  fallback: AppModuleAccess[] = ['hub'],
): AppModuleAccess[] => {
  const fromInput = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[;,]/g)
      : [];

  const normalized = Array.from(
    new Set(
      fromInput
        .map((item) => normalizeLegacyModule(String(item ?? '')))
        .filter((item): item is AppModuleAccess => Boolean(item)),
    ),
  );

  const base = normalized.length
    ? normalized
    : fallback.filter((item, index, list) => list.indexOf(item) === index);

  if (!base.includes('hub')) {
    base.unshift('hub');
  }

  return base;
};

export const hasModuleAccess = (
  value: unknown,
  module: AppModuleAccess,
  fallback: AppModuleAccess[] = ['hub'],
) => normalizeModuleAccess(value, fallback).includes(module);
