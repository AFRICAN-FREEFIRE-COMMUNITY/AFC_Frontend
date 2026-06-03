// Single source of all admin help copy. Keyed area.page.element; _page = page tip,
// _section = section tip, bare key = field/action. `as const` so InfoTip ids are type-checked.
export const HELP = {
  "events.create._page":
    "Create a tournament or scrim — set the details, stages, prizes and rules, then publish.",
} as const;

export type HelpId = keyof typeof HELP;
