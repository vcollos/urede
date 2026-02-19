import { useEffect, useMemo, useState } from 'react';

import DocumentacaoLayout from '../DocumentacaoLayout';
import {
  DEFAULT_USUARIO_DOC_SLUG,
  usuarioDocBySlug,
  usuarioDocPages,
} from './docs';

const BASE_PATH = '/documentacao/usuarios';
const AREA_SUBTITLE =
  'Guias completos para operadores, gestores e auditores utilizarem o portal URede com consistência.';

const normalizePathname = (pathname: string) =>
  pathname.replace(/\/+$/, '') || '/';

const resolveSlugFromPath = (pathname: string) => {
  const normalized = normalizePathname(pathname);
  if (!normalized.startsWith(BASE_PATH)) {
    return DEFAULT_USUARIO_DOC_SLUG;
  }

  const remainder = normalized.slice(BASE_PATH.length).replace(/^\/+/, '');
  if (!remainder) {
    return DEFAULT_USUARIO_DOC_SLUG;
  }

  return usuarioDocBySlug[remainder] ? remainder : DEFAULT_USUARIO_DOC_SLUG;
};

const getInitialSlug = () => {
  if (typeof window === 'undefined') return DEFAULT_USUARIO_DOC_SLUG;
  return resolveSlugFromPath(window.location.pathname);
};

export function DocumentacaoUsuariosApp() {
  const [currentSlug, setCurrentSlug] = useState<string>(getInitialSlug);

  const activeDoc = useMemo(() => {
    return (
      usuarioDocBySlug[currentSlug] ??
      usuarioDocBySlug[DEFAULT_USUARIO_DOC_SLUG]
    );
  }, [currentSlug]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handlePopState = () => {
      setCurrentSlug(resolveSlugFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined' && activeDoc) {
      document.title = `${activeDoc.title} · Documentação URede`;
    }
  }, [activeDoc]);

  if (!activeDoc) return null;

  const handleSelectSlug = (slug: string) => {
    if (typeof window === 'undefined') return;
    const nextDoc = usuarioDocBySlug[slug] ?? activeDoc;
    const nextSlug =
      nextDoc?.slug ?? usuarioDocBySlug[DEFAULT_USUARIO_DOC_SLUG].slug;
    const nextPath =
      nextSlug === DEFAULT_USUARIO_DOC_SLUG
        ? BASE_PATH
        : `${BASE_PATH}/${nextSlug}`;

    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }

    setCurrentSlug(nextSlug);
  };

  return (
    <DocumentacaoLayout
      areaTitle="Documentação de Usuários"
      areaSubtitle={AREA_SUBTITLE}
      breadcrumbs={[
        { label: 'Portal', href: '/' },
        { label: 'Documentação', href: BASE_PATH },
      ]}
      sections={usuarioDocPages}
      currentSlug={activeDoc.slug}
      onSelect={handleSelectSlug}
    />
  );
}

export default DocumentacaoUsuariosApp;
