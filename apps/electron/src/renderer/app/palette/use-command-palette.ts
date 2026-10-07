import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { PALETTE_RECENT_LIMIT } from "./constants";
import { PALETTE_GROUP_ORDER, PALETTE_LABELS } from "./labels";
import { flattenSections, searchCommands } from "./model";
import { registeredCommands, usePaletteRegistry } from "./registry";
import { usePaletteStore } from "./store";
import { useBuiltinCommands } from "./use-builtin-commands";
import { usePaletteNavigation } from "./use-palette-navigation";
import { useProjectCommands } from "./use-project-commands";

export function useCommandPalette() {
  const { open, query, recent, setQuery, close, remember } = usePaletteStore(
    useShallow((state) => ({
      open: state.open,
      query: state.query,
      recent: state.recent,
      setQuery: state.setQuery,
      close: state.close,
      remember: state.remember,
    })),
  );
  const builtin = useBuiltinCommands();
  const projects = useProjectCommands(open);
  const registry = usePaletteRegistry(useShallow((state) => ({ sources: state.sources, order: state.order })));
  const commands = useMemo(() => [...builtin, ...projects, ...registeredCommands(registry)], [builtin, projects, registry]);
  const sections = useMemo(
    () => searchCommands(commands, query, { recent, recentGroup: PALETTE_LABELS.groups.recent, groupOrder: PALETTE_GROUP_ORDER }),
    [commands, query, recent],
  );
  const results = useMemo(() => flattenSections(sections), [sections]);

  const select = useCallback(
    (index: number) => {
      const result = results[index];
      if (!result) return;
      remember(result.command.id, PALETTE_RECENT_LIMIT);
      close();
      result.command.run();
    },
    [close, remember, results],
  );

  const navigation = usePaletteNavigation(results.length, query, select);
  return { open, query, setQuery, close, sections, results, select, ...navigation };
}
