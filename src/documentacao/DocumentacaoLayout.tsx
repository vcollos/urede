import { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  ChevronRight,
  Menu,
  NotebookPen,
  Sparkles,
  Search,
  ArrowUpRight,
} from 'lucide-react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../components/ui/sheet';
import { cn } from '../components/ui/utils';
import { renderMarkdown } from '../utils/markdown';

type DocumentacaoBreadcrumb = {
  label: string;
  href?: string;
};

export type DocumentacaoSection = {
  slug: string;
  title: string;
  description?: string;
  category?: string;
  audience?: string[];
  keywords?: string[];
  content: string;
};

type DocumentHeading = {
  id: string;
  label: string;
  level: 2 | 3;
};

export interface DocumentacaoLayoutProps {
  areaTitle: string;
  areaSubtitle?: string;
  breadcrumbs?: DocumentacaoBreadcrumb[];
  sections: DocumentacaoSection[];
  currentSlug: string;
  onSelect: (slug: string) => void;
}

const FALLBACK_CATEGORY = 'Conteúdo';

const slugify = (value: string, index: number) => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase();
  const dashed = normalized.replace(/\s+/g, '-').replace(/-+/g, '-');
  if (!dashed) return `secao-${index + 1}`;
  return dashed;
};

const enhanceHeadings = (html: string) => {
  const headings: DocumentHeading[] = [];
  const enhanced = html.replace(
    /<h([23])([^>]*)>(.*?)<\/h\1>/g,
    (match, level, attrs, inner, offset, fullString) => {
      const plainText = inner.replace(/<[^>]+>/g, '').trim();
      const existingIdMatch = /id="([^"]+)"/.exec(attrs);
      const id =
        existingIdMatch?.[1] ?? slugify(plainText || `secao-${headings.length + 1}`, headings.length);
      const cleanedAttrs = attrs.replace(/\s*id="[^"]*"/, '').trim();
      const attrString = cleanedAttrs ? ` ${cleanedAttrs}` : '';

      headings.push({
        id,
        label: plainText || `Seção ${headings.length + 1}`,
        level: level === '3' ? 3 : 2,
      });

      return `<h${level}${attrString} id="${id}" data-anchor-level="${level}">${inner}</h${level}>`;
    },
  );

  return { html: enhanced, headings };
};

export function DocumentacaoLayout({
  areaTitle,
  areaSubtitle,
  breadcrumbs = [],
  sections,
  currentSlug,
  onSelect,
}: DocumentacaoLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const activeSection = useMemo(() => {
    if (!sections.length) return null;
    return sections.find((section) => section.slug === currentSlug) ?? sections[0];
  }, [sections, currentSlug]);

  const filteredSections = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    if (!normalizedFilter) return sections;

    const matches: DocumentacaoSection[] = [];
    sections.forEach((section) => {
      const haystack = [
        section.title,
        section.description,
        section.category,
        ...(section.keywords ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (haystack.includes(normalizedFilter)) {
        matches.push(section);
      }
    });

    if (!matches.length) {
      return sections.filter((section) => section.slug === currentSlug);
    }

    if (!matches.some((section) => section.slug === currentSlug)) {
      const activeSection = sections.find((section) => section.slug === currentSlug);
      if (activeSection) {
        matches.push(activeSection);
      }
    }

    return matches;
  }, [sections, filter, currentSlug]);

  const groupedSections = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, DocumentacaoSection[]>();

    filteredSections.forEach((section) => {
      const category = section.category ?? FALLBACK_CATEGORY;
      if (!map.has(category)) {
        map.set(category, []);
        order.push(category);
      }
      map.get(category)?.push(section);
    });

    return order.map((category) => ({
      category,
      items: map.get(category) ?? [],
    }));
  }, [filteredSections]);

  const { html: renderedHtml, headings } = useMemo(() => {
    if (!activeSection) {
      return { html: '', headings: [] as DocumentHeading[] };
    }
    const raw = renderMarkdown(activeSection.content);
    return enhanceHeadings(raw);
  }, [activeSection]);

  const handleNavigate = (slug: string) => {
    if (slug !== currentSlug) {
      onSelect(slug);
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setMobileNavOpen(false);
  };

  const handleHeadingClick = (id: string) => {
    if (typeof document === 'undefined') return;
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `#${id}`);
    }
  };

  if (!activeSection) {
    return null;
  }

  const renderNavigation = () => (
    <div className="space-y-8">
      {groupedSections.map(({ category, items }) => (
        <div key={category} className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {category}
          </p>
          <div className="space-y-1.5">
            {items.map((item) => {
              const isActive = item.slug === activeSection.slug;
              return (
                <Button
                  key={item.slug}
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2 rounded-lg border border-transparent text-left transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                  )}
                  onClick={() => handleNavigate(item.slug)}
                >
                  <span className="flex h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  <span className="flex-1 text-sm font-medium leading-tight">{item.title}</span>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(108,85,217,0.08),_transparent_58%)]">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpenCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-primary/70">
                  Documentação uRede
                </p>
                <Breadcrumb>
                  <BreadcrumbList className="flex flex-wrap items-center gap-1 text-muted-foreground">
                    {breadcrumbs.map((crumb, index) => (
                      <BreadcrumbItem key={`${crumb.label}-${index}`}>
                        {crumb.href ? (
                          <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                        ) : (
                          <span>{crumb.label}</span>
                        )}
                        {index !== breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                      </BreadcrumbItem>
                    ))}
                    <BreadcrumbItem>
                      <span className="text-foreground">{activeSection.title}</span>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <h1 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">{areaTitle}</h1>
                {areaSubtitle && (
                  <p className="mt-2 max-w-3xl text-base text-muted-foreground sm:text-lg">
                    {areaSubtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
              <Button
                variant="outline"
                className="hidden rounded-full border-border text-sm text-muted-foreground hover:text-foreground md:inline-flex"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open('/documentacao/usuarios', '_self');
                  }
                }}
              >
                Abrir Home da Documentação
              </Button>
              <Button
                variant="default"
                className="w-full rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90 sm:w-auto"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open('/', '_self');
                  }
                }}
              >
                Portal Principal
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-full border-border bg-background text-foreground shadow-sm hover:bg-muted/50 lg:hidden"
                    aria-label="Abrir índice da documentação"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full max-w-[360px] p-0">
                  <SheetHeader className="border-b border-border/60 bg-background/90 px-6 py-4 text-left">
                    <SheetTitle className="flex items-center gap-2 text-base text-foreground">
                      <NotebookPen className="h-4 w-4 text-primary" />
                      Índice da Documentação
                    </SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-full px-6 py-6">
                    <div className="mb-6">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={filter}
                          onChange={(event) => setFilter(event.target.value)}
                          placeholder="Buscar tópicos"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    {renderNavigation()}
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="rounded-full border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Área de conhecimento uRede
            </Badge>
            {activeSection.keywords?.slice(0, 3).map((keyword) => (
              <Badge key={keyword} variant="outline" className="rounded-full border-muted-foreground/20">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-14 pt-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_240px] lg:px-6">
        <aside className="sticky top-28 hidden h-max lg:block">
          <Card className="border-0 bg-background/80 shadow-lg shadow-muted/30 backdrop-blur">
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <NotebookPen className="h-4 w-4 text-primary" />
                  Sumário
                </CardTitle>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Buscar tópicos"
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-[60vh] pr-1">{renderNavigation()}</ScrollArea>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-6">
          <Card className="border-0 bg-background shadow-xl shadow-muted/40 backdrop-blur">
            <CardHeader className="gap-3 border-b border-border/60 bg-gradient-to-r from-background to-muted/60">
              <div>
                <p className="text-sm font-medium text-primary/80">{activeSection.category ?? FALLBACK_CATEGORY}</p>
                <CardTitle className="text-2xl font-semibold text-foreground">
                  {activeSection.title}
                </CardTitle>
                {activeSection.description && (
                  <p className="mt-1 text-base text-muted-foreground">{activeSection.description}</p>
                )}
              </div>
              {activeSection.audience?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {activeSection.audience.map((audience) => (
                    <Badge
                      key={audience}
                      variant="secondary"
                      className="rounded-full border border-primary/10 bg-primary/10 text-primary"
                    >
                      {audience}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="pt-6">
              <div
                className={cn(
                  'prose prose-slate max-w-none text-base leading-7',
                  'prose-headings:scroll-mt-32 prose-headings:font-semibold prose-p:text-muted-foreground',
                  'prose-h2:rounded-lg prose-h2:border prose-h2:border-primary/10 prose-h2:bg-primary/5 prose-h2:px-4 prose-h2:py-3 prose-h2:text-xl prose-h2:text-foreground',
                  'prose-h3:mt-6 prose-h3:text-lg prose-h3:text-foreground/90',
                  'prose-li:marker:text-primary prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:bg-primary/5 prose-blockquote:px-4 prose-blockquote:py-2',
                  'prose-code:rounded-md prose-code:bg-muted/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-primary',
                  'prose-pre:bg-muted/90 prose-pre:text-muted-foreground',
                  'prose-table:rounded-lg prose-table:border prose-table:border-border/60',
                  'prose-th:bg-muted/60 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2',
                )}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </CardContent>
          </Card>

          <Card className="border border-dashed border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-4 py-5 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Personalize o conteúdo</p>
                  <p>
                    Edite os arquivos Markdown em <code className="rounded bg-background px-1 py-0.5 text-xs">src/documentacao/usuarios</code> para manter a documentação sempre atualizada.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="rounded-full border-primary/20 text-primary hover:bg-primary/10"
                onClick={() => handleNavigate(currentSlug)}
              >
                Voltar ao topo
              </Button>
            </CardContent>
          </Card>
        </section>

        <aside className="sticky top-28 hidden h-max space-y-3 xl:block">
          <Card className="border-0 bg-background/80 shadow-lg shadow-muted/30 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Pontos-chave
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {activeSection.description && (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                  {activeSection.description}
                </p>
              )}
              <Separator />
              <div className="space-y-2">
                {headings.length ? (
                  headings.map((heading) => (
                    <Button
                      key={heading.id}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'w-full justify-start gap-2 rounded-lg text-left text-sm text-muted-foreground hover:text-foreground',
                        heading.level === 3 && 'pl-6 text-xs uppercase tracking-wide',
                      )}
                      onClick={() => handleHeadingClick(heading.id)}
                    >
                      <span className="flex h-1.5 w-1.5 rounded-full bg-primary/40" />
                      {heading.label}
                    </Button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Este tópico não possui subtítulos adicionais.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

export default DocumentacaoLayout;
