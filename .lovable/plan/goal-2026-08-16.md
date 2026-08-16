Make Modules "Bulk upload" open the file picker immediately

## Goal
On the Modules registry page (`/strategic/modules`), clicking the **Bulk upload** button should immediately open the OS file picker instead of first opening an empty dialog.

## Current behavior
The button is wrapped in a `DialogTrigger`. Clicking it opens a dialog that contains the file input, instructions, preview table, and confirm button.

## Proposed change
1. Replace the dialog-trigger button with a direct file-picker button.
   - Add a hidden `<input type="file" accept=".xlsx,.xls" ref={fileRef}>`.
   - Clicking **Bulk upload** calls `fileRef.current?.click()`.
2. Keep the preview/confirmation dialog, but open it only after a file is selected and parsed.
   - `handleFile` remains responsible for parsing and then sets the dialog open.
3. Preserve existing UX:
   - Template download button stays visible.
   - Parsed-row preview and **Confirm upload** remain inside the dialog.
   - Cancel/close resets `parsed`, `fileName`, and dialog state.

## Files to edit
- `src/routes/_authenticated/strategic/modules.tsx`

## Out of scope
- No server-function changes.
- No changes to the single-module creation dialog or the modules table.
