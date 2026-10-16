# Manager access also comes from the International Directory board

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else.**

Access groups are rebuilt from the Monday Panama Directory, and **any group Monday did not produce
is deleted**. So the managers of international employees (Marcela, Yankel) must come from the
International Directory board too, or their groups would vanish on every sync. This prompt adds
that board's Current rows to the list the access planner already receives. The planner itself
(`accessSeed.ts`) does not change.

**Only this file may change:** `src/app/pages/admin/access/syncAccessFromMonday.ts`. **No other
file may be touched.** Untouchable files as usual. Under 15 KB.

## 1. In `syncAccessFromMonday`, change `const people = items` to `let people = items`

(the expression after it stays exactly the same).

## 2. Directly after that `people` statement (before `const idByEmail`), add:

```ts
  // International Employee Directory: one manager slot (Manager + Manager Email). Off while unset.
  const intlBoard = deps.cfg.monday_board_directory_intl;
  const intlEmailCol = deps.cfg.monday_col_intl_email;
  const intlGroup = deps.cfg.monday_group_intl_current;
  const intlMgrCol = deps.cfg.monday_col_intl_manager ?? '';
  const intlMgrEmailCol = deps.cfg.monday_col_intl_manager_email ?? '';
  if (intlBoard && intlEmailCol && intlGroup && intlMgrEmailCol) {
    const intlItems = await pullAllItems(intlBoard, [intlEmailCol, intlMgrEmailCol, ...(intlMgrCol ? [intlMgrCol] : [])], deps.pull);
    const blank = { name: '', email: '' };
    people = people.concat(intlItems
      .filter(it => it.group?.id === intlGroup)
      .map(it => ({
        name: it.name,
        email: norm(colText(it, intlEmailCol)),
        managers: [
          { name: intlMgrCol ? colText(it, intlMgrCol) : '', email: norm(colText(it, intlMgrEmailCol)) },
          blank, blank, blank,
        ],
      })));
  }
```

Nothing else changes. If the planner's person type differs from this shape, match the shape the
Panama rows already use above and say what you changed.

Reply with the diff.
