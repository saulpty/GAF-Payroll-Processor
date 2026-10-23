# Every HR Hub change: the cheat sheet

Two Chrome tabs. **Tab 1** = UIB builder (prompts only). **Tab 2** = `/dev` app (Export + looking).

```
 START A CHAT in Project "GAF HR Hub"
 Attach: newest GOOD hub zip + newest GOOD form zip (+ hub-harness.zip, unless it's in Project files)
 Claude runs the baseline → "957/958, L2 known" → asks what to work on
        │
        ▼
 ① Tell Claude what you want ──► Claude writes the UIB prompt
        │                          (copy button + download; save it in prompts\)
        ▼
 ② Tab 1: paste into UIB's AI box
    ✔ check the box ends with END OF PROMPT before you send
    wait until it says "Ask UI Bakery..." AND the last message is this prompt's summary
    copy UIB's final file list → paste it to Claude
        │
        ▼
 ③ Tab 2: ⋮ next to the app name → Export → attach the NEWEST zip to the chat
        │
        ▼
 ④ Claude runs the check ──► table: files ✔/✘ · payroll files · size · tests
        │
        ▼
 ⑤ Tab 2: Ctrl+Shift+R → screenshot the page → send it to Claude
        │
   ┌────┴─────┐
 PASS        FAIL
   │           │
   │           └► Tab 1: "Revert to this checkpoint" on the message
   │              before the prompt → Claude writes a fix prompt → back to ②
   ▼
 ⑥ Rename the zip "YYYY-MM-DD hub - topic.zip" → move it into GOOD\
   (Release to prod = only you, only after PASS)
        │
        ▼
 ⑦ END: Claude gives you files + a table of where each goes
    handoffs\ · prompts\ · replace in Project files · kit\
```

## Never

| ✘ | Why |
|---|---|
| Press UIB's **Fix** button | It edits working files hunting for a fault that may not exist. "Ignore" is fine |
| Open a second builder tab | Two editors fight each other |
| Delete anything from GOOD\ | It's your history and your undo |
| Accept "it's fixed" without the check table **and** a screenshot | UIB once said "everything looks correct" about a change that returned zero employees |
| Diff a Hub zip against a Form zip | They're different apps. The script refuses, but pick the right GOOD zip anyway |

## If the check says `0 added, 0 changed`

Usually the Export click only closed the menu. Look in Downloads for a zip with a newer time. Re-export if needed.
