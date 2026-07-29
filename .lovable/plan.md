## ERP User Manual — Project Blueprint

One interactive, multi-section user manual for the Acme Corp ERP, built as a React + TypeScript app with shadcn/ui and Tailwind.

### One technical substitution
Routing uses **TanStack Router** (file-based, already the fixed router on this stack) instead of React Router. Same result — real URLs per manual section, deep-linkable and shareable. Everything else follows your spec exactly.

---

### Design system
Tokens defined centrally (in `src/styles.css`), never hardcoded in components:

| Token | Value | Use |
|---|---|---|
| primary | `#1e40af` | headers, active nav, primary buttons |
| secondary | `#3b82f6` | links, hover states, step markers |
| accent | `#f59e0b` | callouts, tips, stat highlights |
| background | `#f8fafc` | page canvas |
| surface | `#ffffff` | cards, sidebar |

Typography: Inter (loaded via a `<link>` in the root route head). Brand mark: Lucide `Settings` gear + "Acme Corp" wordmark, top-left of the sidebar.

### Layout

```text
+--------------------------------------------------------------+
| [gear] Acme Corp — ERP User Manual        [search]  [print]   |
+----------------+---------------------------------------------+
| Sidebar        | Breadcrumb: Manual / Inventory Management    |
|  Dashboard     |                                              |
|  Inventory   * | H1 Module Title + 2-3 sentence description   |
|  Sales Orders  | [Stat] [Stat] [Stat] [Stat]                  |
|  Purchasing    | <img screenshot-inventory-dashboard.png>     |
|  Reporting     | Key Tasks (accordion, numbered steps)        |
|  User Admin    | Tip / warning callouts (accent)              |
|                | < Prev module        Next module >           |
+----------------+---------------------------------------------+
```

Sidebar collapses to an icon rail on desktop and a slide-over sheet on mobile.

### Routes
- `/` — manual home: welcome, how to use this manual, grid of 6 module cards
- `/modules/dashboard-overview`
- `/modules/inventory-management`
- `/modules/sales-orders`
- `/modules/purchasing`
- `/modules/reporting-analytics`
- `/modules/user-administration`

### Content model
All manual content lives in typed data files, so pages are pure presentation and content is editable without touching components.

```ts
type Step = { title: string; detail: string; note?: string }
type Task = { id: string; title: string; goal: string; steps: Step[] }
type Stat = { label: string; value: string; icon: LucideIcon }
type Module = {
  slug: string; title: string; description: string; icon: LucideIcon
  screenshots: { src: string; alt: string; caption: string }[]
  stats: Stat[]          // 3-4 per module
  tasks: Task[]          // 3-5 per module
  related: string[]      // slugs
}
```

Module content to author:
1. **Dashboard Overview** — stats: Active Users 128, Open Orders 342, Revenue MTD $1.2M, Alerts 7. Tasks: read the KPI strip, filter by date range, customise widgets, drill into a metric.
2. **Inventory Management** — Total Products 1,247, Low Stock 32, Warehouses 4, Stock Value $894K. Tasks: add a product, adjust stock levels, set reorder points, run a stock count, transfer between warehouses.
3. **Sales Order Processing** — Open Orders 342, Fulfilled MTD 1,880, Avg Order $612, Overdue Invoices 14. Tasks: create a sales order, apply pricing/discount, confirm and allocate stock, generate an invoice, process a return.
4. **Purchasing** — Active Vendors 96, Open POs 71, Spend MTD $410K, Pending Approvals 9. Tasks: onboard a vendor, raise a purchase order, approve a PO, receive goods, match invoice to receipt.
5. **Reporting & Analytics** — Saved Reports 58, Scheduled Exports 12, Dashboards 9, Data Refresh 15 min. Tasks: run a standard report, build a custom view, chart the results, schedule an export, share with a team.
6. **User Administration** — Users 128, Roles 11, Permission Sets 42, MFA Adoption 87%. Tasks: invite a user, assign roles, create a custom role, review the audit trail, enforce security policy.

Screenshots are `<img>` placeholders with descriptive alt text (e.g. `screenshot-inventory-dashboard.png`) inside a bordered figure with caption — swap in real images later without layout change.

### Components to build
- `ManualLayout` — sidebar + header shell, renders the outlet
- `ManualSidebar` — nav list with active highlight and mobile sheet
- `ModulePage` — generic renderer driven by a `Module` object
- `StatCard`, `ScreenshotFigure`, `TaskAccordion`, `StepList`, `Callout`, `ModulePager`
- `SearchCommand` — ⌘K palette over module and task titles
- `ManualContext` — React Context holding current module, search query, sidebar state, and reading progress (completed tasks persisted to localStorage)

### Extras included
- Client-side search across all modules and tasks
- "Mark task complete" checkboxes with per-module progress bar
- Print-friendly stylesheet so any module prints cleanly
- Per-route SEO head: unique title, description, and social tags

### Build order
1. Design tokens, Inter font, layout shell and sidebar navigation
2. Content model plus data files for all 6 modules
3. Generic `ModulePage` renderer with stats, screenshots, task accordion
4. Manual home page and module card grid
5. Context: search palette, progress tracking, sidebar state
6. Print styles, responsive pass, SEO metadata

Approve and I'll build it in that order.