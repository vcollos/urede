export type AppModuleAccess = 'hub' | 'urede';

const ALLOWED_MODULES: AppModuleAccess[] = ['hub', 'urede'];

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
        .map((item) => String(item ?? '').trim().toLowerCase())
        .filter((item): item is AppModuleAccess => ALLOWED_MODULES.includes(item as AppModuleAccess)),
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

