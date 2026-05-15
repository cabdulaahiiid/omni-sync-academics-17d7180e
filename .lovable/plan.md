**Goal:** Stop showing the floating "Offline" pill in the preview.

**Change (single file):** `src/components/offline-banner.tsx`
- Remove the offline-state branch so the banner only surfaces when there are `pending` actions or `conflicts` to resolve.
- Update the early-return so the component renders nothing whenever `pending === 0 && conflicts === 0`, regardless of `online`.
- Drop the now-unused `WifiOff` import.

**Not changed:** `useOfflineSync` hook keeps tracking real connectivity (still needed to gate background sync). We're only suppressing the visual "Offline" chip.

If you'd rather fully remove the banner everywhere (including pending/conflict notices), say the word and I'll unmount it from the three shells instead.