# Manager access also comes from the International Directory board

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else.**

Access groups are rebuilt from the Monday Panama Directory, and **any group Monday did not produce
is deleted**. So the managers of international employees (Marcela, Yankel) must come from the
International Directory board too, or their groups would vanish on every sync. This prompt adds
that board's Current rows (Manager = slot 1, Manager 2 = slot 2) to the list the access planner already receives. The planner itself
(`accessSeed.ts`) does not change.

**Only this file may change:** `src/app/pages/admin/access/syncAccessFromMonday.ts`. **No other
file may be touched.** Untouchable files as usual. Under 15 KB.

## 1. In `syncAccessFromMonday`, change `const people = items` to `let people = items`

(the expression after it stays exactly the same).

## 2. Directly after that `people` statement (before `const idByEmail`), add:

```ts
  // International Employee Directory: two manager slots (Manager, Manager 2). Off while unset.
  const ic = (key: string) => (deps.cfg[key] ?? '').trim();
  const intlBoard = ic('monday_board_directory_intl');
  const intlEmailCol = ic('monday_col_intl_email');
  const intlGroup = ic('monday_group_intl_current');
  const intlSlots = [
    [ic('monday_col_intl_manager'), ic('monday_col_intl_manager_email')],
    [ic('monday_col_intl_manager2'), ic('monday_col_intl_manager2_email')],
  ] as const;
  if (intlBoard && intlEmailCol && intlGroup && intlSlots[0][1]) {
    const intlCols = [intlEmailCol, ...intlSlots.flat().filter(Boolean)];
    const intlItems = await pullAllItems(intlBoard, intlCols, deps.pull);
    const read = (it: Parameters<typeof colText>[0], col: string) => (col ? colText(it, col) : '');
    people = people.concat(intlItems
      .filter(it => it.group?.id === intlGroup)
      .map(it => ({
        name: it.name,
        email: norm(colText(it, intlEmailCol)),
        managers: [
          ...intlSlots.map(([nameCol, emailCol]) => ({ name: read(it, nameCol), email: norm(read(it, emailCol)) })),
          { name: '', email: '' }, { name: '', email: '' },
        ],
      })));
  }
```

Nothing else changes. If the planner's person type differs from this shape, match the shape the
Panama rows already use above and say what you changed.

Reply with the diff.
