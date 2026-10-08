import { useCallback, useEffect, useLayoutEffect, useState, type MouseEvent } from "react";

export type DashboardArea = "hoje" | "resultado" | "custos" | "mais";

const areas: { id: DashboardArea; label: string; icon: React.ReactNode }[] = [
  {
    id: "hoje",
    label: "Hoje",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
        <path d="M8 14h.01"></path>
        <path d="M12 14h.01"></path>
        <path d="M16 14h.01"></path>
        <path d="M8 18h.01"></path>
        <path d="M12 18h.01"></path>
        <path d="M16 18h.01"></path>
      </svg>
    ),
  },
  {
    id: "resultado",
    label: "Resultados",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    ),
  },
  {
    id: "custos",
    label: "Custos",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
    ),
  },
  {
    id: "mais",
    label: "Mais",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="19" cy="12" r="1"></circle>
        <circle cx="5" cy="12" r="1"></circle>
      </svg>
    ),
  },
];

const targetAreas: Record<string, DashboardArea> = {
  hoje: "hoje",
  "primeiro-resultado": "hoje",
  "daily-entry-result": "hoje",
  "daily-revenue": "hoje",
  "daily-expense-form": "hoje",
  "today-summary": "hoje",
  "quick-start": "hoje",
  resultado: "resultado",
  metas: "resultado",
  insights: "resultado",
  evolucao: "resultado",
  "detalhes-resultado": "resultado",
  padroes: "resultado",
  custos: "custos",
  "lista-despesas": "custos",
  "despesas-recorrentes": "custos",
  manutencao: "custos",
  veiculos: "custos",
  mais: "mais",
  jornadas: "mais",
  "lista-jornadas": "mais",
  conta: "mais",
};

function knownTarget(value: string): string | null {
  try {
    const target = decodeURIComponent(value.replace(/^#/, ""));
    return Object.hasOwn(targetAreas, target) ? target : null;
  } catch {
    return null;
  }
}

export function getDashboardArea(target: string): DashboardArea {
  return targetAreas[knownTarget(target) ?? "hoje"];
}

function currentTarget(): string {
  return typeof window === "undefined" ? "hoje" : knownTarget(window.location.hash) ?? "hoje";
}

function focusDestination(element: HTMLElement) {
  if (element.tabIndex < 0 && !element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "-1");
  }
  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: "auto", block: "start" });
}

export function useDashboardNavigation(enabled: boolean) {
  const [navigation, setNavigation] = useState(() => ({ target: currentTarget() }));
  const activeArea = getDashboardArea(navigation.target);

  const navigateTo = useCallback((value: string) => {
    const target = knownTarget(value) ?? "hoje";
    const hash = `#${target}`;
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
    }
    setNavigation({ target });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const syncLocation = () => {
      const target = currentTarget();
      setNavigation((current) => current.target === target ? current : { target });
    };
    syncLocation();
    window.addEventListener("hashchange", syncLocation);
    window.addEventListener("popstate", syncLocation);
    return () => {
      window.removeEventListener("hashchange", syncLocation);
      window.removeEventListener("popstate", syncLocation);
    };
  }, [enabled]);

  useLayoutEffect(() => {
    if (!enabled || (!window.location.hash && navigation.target === "hoje")) return;

    const area = document.getElementById(`area-${activeArea}`);
    const revealDestination = () => {
      const destination = navigation.target === activeArea
        ? document.getElementById(`area-${activeArea}`)
        : document.getElementById(navigation.target);
      if (!destination || destination.closest("[hidden]")) return false;

      for (let ancestor: HTMLElement | null = destination; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      }
      focusDestination(destination);
      return true;
    };

    if (revealDestination()) return;

    if (area && !area.hidden) focusDestination(area);
    const observer = new MutationObserver(() => {
      if (revealDestination()) observer.disconnect();
    });
    observer.observe(area ?? document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
    return () => observer.disconnect();
  }, [enabled, activeArea, navigation]);

  const handleNavigationClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!link || !event.currentTarget.contains(link) || link.hasAttribute("download") || (link.target && link.target !== "_self")) {
      return;
    }
    const href = link.getAttribute("href");
    if (!href?.startsWith("#") || !knownTarget(href)) return;

    event.preventDefault();
    navigateTo(href);
  }, [navigateTo]);

  return { activeArea, target: navigation.target, navigateTo, handleNavigationClick };
}

export function DashboardNavigation({ activeArea }: { activeArea: DashboardArea }) {
  return (
    <nav className="dashboard-nav" aria-label="Navegação principal">
      {areas.map(({ id, label, icon }) => (
        <a 
          key={id} 
          href={`#${id}`} 
          className={activeArea === id ? "active" : ""}
          aria-current={activeArea === id ? "page" : undefined}
        >
          <span className="nav-icon" aria-hidden="true">{icon}</span>
          <span className="nav-label">{label}</span>
        </a>
      ))}
    </nav>
  );
}