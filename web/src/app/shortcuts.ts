/** The shortcut list shown in the help dialog. Screens register the keys themselves with useHotkey. */
export const SHORTCUTS: { group: string; items: [label: string, keys: string[]][] }[] = [
  {
    group: 'Anywhere',
    items: [
      ['Search and jump', ['⌘', 'K']],
      ['New capture', ['C']],
      ['Go to Inbox, Drafts, Archive, Results', ['G', 'then I / D / A / R']],
      ['Show shortcuts', ['?']],
    ],
  },
  {
    group: 'Reviewing a draft',
    items: [
      ['Accept', ['A']],
      ['Edit', ['E']],
      ['Reject', ['R']],
      ['Next or previous sentence', ['J', 'K']],
    ],
  },
  {
    group: 'Calibration',
    items: [['Same angle or different', ['→', '←']]],
  },
];
