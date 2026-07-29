import {
  LayoutDashboard, Boxes, ShoppingCart, Truck, BarChart3, ShieldCheck,
  Users, ClipboardList, DollarSign, Bell, PackageSearch, AlertTriangle,
  Warehouse, Wallet, CheckCircle2, Receipt, TrendingUp, FileSpreadsheet,
  CalendarClock, Gauge, KeyRound, Fingerprint, Building2, FileStack,
} from "lucide-react";
import type { ManualModule } from "./types";

export const MANUAL_MODULES: ManualModule[] = [
  {
    slug: "dashboard-overview",
    title: "Dashboard Overview",
    short: "Dashboard",
    icon: LayoutDashboard,
    description:
      "The Dashboard is the landing screen of the Acme Corp ERP and the fastest way to read the health of the business. It gathers live figures from inventory, sales, purchasing and finance into a single strip of KPIs and a configurable widget grid. Every tile is a shortcut — selecting a number opens the underlying records behind it.",
    screenshots: [
      { src: "screenshot-dashboard-overview.png", alt: "screenshot-dashboard-overview.png", caption: "The default dashboard with the KPI strip and widget grid." },
      { src: "screenshot-dashboard-widget-editor.png", alt: "screenshot-dashboard-widget-editor.png", caption: "Widget editor used to add, remove and reorder dashboard cards." },
    ],
    stats: [
      { label: "Active Users", value: "128", icon: Users },
      { label: "Open Orders", value: "342", icon: ClipboardList },
      { label: "Revenue MTD", value: "$1.2M", icon: DollarSign },
      { label: "Alerts", value: "7", icon: Bell },
    ],
    callouts: [
      { kind: "tip", text: "Dashboard figures refresh every 15 minutes. Use the refresh control in the header for an on-demand update before a meeting." },
    ],
    tasks: [
      {
        id: "read-kpi-strip",
        title: "Read the KPI strip",
        goal: "Understand what each headline number represents and when it was last calculated.",
        steps: [
          { title: "Open the Dashboard", detail: "Select Dashboard in the left navigation. The KPI strip loads at the top of the page." },
          { title: "Check the comparison badge", detail: "Each tile shows a percentage change against the previous period. Green is an improvement, red is a decline." },
          { title: "Confirm the refresh time", detail: "The timestamp beside the page title tells you how current the figures are.", note: "Figures older than one hour are shown in muted text." },
        ],
      },
      {
        id: "filter-date-range",
        title: "Filter by date range",
        goal: "Restrict every dashboard widget to a specific period.",
        steps: [
          { title: "Open the period picker", detail: "Select the date range control in the page header." },
          { title: "Pick a preset or custom range", detail: "Choose Today, This Week, This Month, This Quarter, or set explicit From and To dates." },
          { title: "Apply", detail: "Select Apply. All KPI tiles and widgets recalculate against the chosen period." },
        ],
      },
      {
        id: "customise-widgets",
        title: "Customise the widget grid",
        goal: "Show only the widgets relevant to your role and arrange them in reading order.",
        steps: [
          { title: "Enter edit mode", detail: "Select Customise in the top-right of the dashboard." },
          { title: "Add or remove widgets", detail: "Tick the widgets you want from the catalogue panel; untick the ones you do not need." },
          { title: "Reorder by dragging", detail: "Drag a widget by its header to a new position in the grid." },
          { title: "Save the layout", detail: "Select Save layout. The arrangement is stored against your user account only." },
        ],
      },
      {
        id: "drill-into-metric",
        title: "Drill into a metric",
        goal: "Move from a summary number to the transactions that produced it.",
        steps: [
          { title: "Select a KPI tile", detail: "Selecting Open Orders, for example, opens the sales order list filtered to open status." },
          { title: "Review the filtered list", detail: "The filter chips at the top of the list show which conditions were carried across." },
          { title: "Export or continue", detail: "Use Export to take the filtered set to Excel, or open an individual record to act on it." },
        ],
      },
    ],
    related: ["reporting-analytics", "sales-orders"],
  },
  {
    slug: "inventory-management",
    title: "Inventory Management",
    short: "Inventory",
    icon: Boxes,
    description:
      "Inventory Management holds the master product catalogue and the running stock balance for every warehouse. It is the source of truth for availability used by sales, purchasing and fulfilment. Accurate reorder points and regular counts here prevent both stock-outs and overstock.",
    screenshots: [
      { src: "screenshot-inventory-dashboard.png", alt: "screenshot-inventory-dashboard.png", caption: "Inventory dashboard showing stock value and low-stock items." },
      { src: "screenshot-inventory-product-form.png", alt: "screenshot-inventory-product-form.png", caption: "Product record with identification, pricing and stock control tabs." },
    ],
    stats: [
      { label: "Total Products", value: "1,247", icon: PackageSearch },
      { label: "Low Stock Items", value: "32", icon: AlertTriangle },
      { label: "Warehouses", value: "4", icon: Warehouse },
      { label: "Stock Value", value: "$894K", icon: Wallet },
    ],
    callouts: [
      { kind: "warning", text: "Stock adjustments are permanent and appear in the audit trail. Correct a mistake with a second, opposite adjustment rather than editing history." },
    ],
    tasks: [
      {
        id: "add-product",
        title: "Add a new product",
        goal: "Create a catalogue record that can be sold, purchased and counted.",
        steps: [
          { title: "Open the product list", detail: "Go to Inventory → Products and select New Product." },
          { title: "Enter identification", detail: "Provide SKU, product name, category and unit of measure. The SKU must be unique." },
          { title: "Set pricing", detail: "Enter standard cost and list price. Tax class determines how the item is treated on invoices." },
          { title: "Set stock control", detail: "Choose the default warehouse, reorder point and reorder quantity." },
          { title: "Save and activate", detail: "Select Save. Set status to Active to make the product available to sales and purchasing.", note: "Draft products are hidden from order entry." },
        ],
      },
      {
        id: "adjust-stock",
        title: "Adjust stock levels",
        goal: "Correct an on-hand quantity after damage, loss or a discovery.",
        steps: [
          { title: "Locate the product", detail: "Search by SKU or name in Inventory → Products." },
          { title: "Open Adjust Stock", detail: "On the product record, select Actions → Adjust Stock." },
          { title: "Enter the change", detail: "Choose the warehouse, enter a positive or negative quantity and select a reason code." },
          { title: "Post the adjustment", detail: "Select Post. The balance updates immediately and a stock movement is written to the ledger." },
        ],
      },
      {
        id: "reorder-points",
        title: "Set reorder points",
        goal: "Trigger automatic low-stock alerts and suggested purchase orders.",
        steps: [
          { title: "Open Stock Control", detail: "On the product record, open the Stock Control tab." },
          { title: "Enter minimum and reorder quantity", detail: "Base the minimum on average daily usage multiplied by supplier lead time." },
          { title: "Enable replenishment suggestions", detail: "Tick Include in replenishment run so the item appears in Purchasing suggestions." },
          { title: "Save", detail: "Items below the minimum immediately appear in the Low Stock widget." },
        ],
      },
      {
        id: "stock-count",
        title: "Run a stock count",
        goal: "Reconcile the recorded balance with what is physically on the shelf.",
        steps: [
          { title: "Create the count", detail: "Go to Inventory → Stock Counts and select New Count. Choose a warehouse and, optionally, a category filter." },
          { title: "Generate count sheets", detail: "Select Generate. Print the sheets or use the mobile count view." },
          { title: "Enter counted quantities", detail: "Record the physical quantity for each line. Variances are highlighted automatically." },
          { title: "Review and post", detail: "Approve the variance report, then select Post Count to write the adjustments." },
        ],
      },
      {
        id: "warehouse-transfer",
        title: "Transfer stock between warehouses",
        goal: "Move inventory while keeping both balances accurate and traceable.",
        steps: [
          { title: "Create a transfer", detail: "Go to Inventory → Transfers and select New Transfer." },
          { title: "Choose source and destination", detail: "Select the origin and receiving warehouses and add product lines with quantities." },
          { title: "Dispatch", detail: "Select Dispatch. The stock moves into an in-transit balance." },
          { title: "Confirm receipt", detail: "The receiving site opens the transfer and selects Receive, confirming the quantities that arrived." },
        ],
      },
    ],
    related: ["purchasing", "sales-orders"],
  },
  {
    slug: "sales-orders",
    title: "Sales Order Processing",
    short: "Sales Orders",
    icon: ShoppingCart,
    description:
      "Sales Order Processing carries a customer commitment from quotation through to invoice and, where needed, return. It reserves stock, applies the correct price list and produces the documents finance depends on. Orders here feed both the dashboard revenue figure and inventory availability.",
    screenshots: [
      { src: "screenshot-sales-order-list.png", alt: "screenshot-sales-order-list.png", caption: "Sales order list with status filters and quick actions." },
      { src: "screenshot-sales-order-entry.png", alt: "screenshot-sales-order-entry.png", caption: "Order entry screen with line items, pricing and availability." },
    ],
    stats: [
      { label: "Open Orders", value: "342", icon: ClipboardList },
      { label: "Fulfilled MTD", value: "1,880", icon: CheckCircle2 },
      { label: "Average Order", value: "$612", icon: DollarSign },
      { label: "Overdue Invoices", value: "14", icon: Receipt },
    ],
    callouts: [
      { kind: "tip", text: "Confirming an order allocates stock. If availability is tight, leave the order in Draft until the customer confirms." },
    ],
    tasks: [
      {
        id: "create-order",
        title: "Create a sales order",
        goal: "Capture what the customer wants to buy, at the right price.",
        steps: [
          { title: "Start a new order", detail: "Go to Sales → Orders and select New Order." },
          { title: "Select the customer", detail: "Search by name or account code. Payment terms and price list default from the customer record." },
          { title: "Add line items", detail: "Add products and quantities. Available-to-promise appears beside each line." },
          { title: "Set delivery details", detail: "Confirm the shipping address and requested delivery date." },
          { title: "Save as draft", detail: "Select Save. The order receives a number and can be edited until it is confirmed." },
        ],
      },
      {
        id: "pricing-discount",
        title: "Apply pricing and discounts",
        goal: "Adjust an order within the limits your role allows.",
        steps: [
          { title: "Open the line", detail: "Select a line item to expand its pricing panel." },
          { title: "Apply a discount", detail: "Enter a percentage or amount discount. The margin indicator updates live." },
          { title: "Request approval if required", detail: "Discounts above your threshold create an approval task for a sales manager.", note: "The order cannot be confirmed while an approval is pending." },
        ],
      },
      {
        id: "confirm-allocate",
        title: "Confirm the order and allocate stock",
        goal: "Commit the order and reserve inventory for fulfilment.",
        steps: [
          { title: "Review the order", detail: "Check quantities, pricing and delivery date." },
          { title: "Select Confirm", detail: "The status moves to Confirmed and stock is allocated from the nominated warehouse." },
          { title: "Handle shortfalls", detail: "Lines that cannot be allocated are flagged as backordered and appear in the replenishment run." },
        ],
      },
      {
        id: "generate-invoice",
        title: "Generate an invoice",
        goal: "Bill the customer for what was shipped.",
        steps: [
          { title: "Confirm despatch", detail: "Open the order and check that the shipment is marked as Despatched." },
          { title: "Create the invoice", detail: "Select Actions → Create Invoice. Choose full or partial invoicing." },
          { title: "Review and post", detail: "Check tax and totals, then select Post. The invoice becomes read-only and enters the receivables ledger." },
          { title: "Send to the customer", detail: "Select Email Invoice to send the PDF to the billing contact." },
        ],
      },
      {
        id: "process-return",
        title: "Process a return",
        goal: "Take goods back into stock and credit the customer.",
        steps: [
          { title: "Raise a return", detail: "Open the original order and select Actions → Create Return." },
          { title: "Select lines and reason", detail: "Choose the returned lines, quantities and a reason code." },
          { title: "Receive the goods", detail: "On arrival, select Receive Return. Choose whether stock returns to sellable or quarantine." },
          { title: "Issue the credit note", detail: "Select Create Credit Note and post it against the original invoice." },
        ],
      },
    ],
    related: ["inventory-management", "reporting-analytics"],
  },
  {
    slug: "purchasing",
    title: "Purchasing",
    short: "Purchasing",
    icon: Truck,
    description:
      "Purchasing manages the supply side: vendor records, purchase orders, approvals, goods receipt and invoice matching. It closes the loop with Inventory by increasing stock when goods arrive. Approval thresholds here are the main control over unplanned spend.",
    screenshots: [
      { src: "screenshot-purchasing-vendor-list.png", alt: "screenshot-purchasing-vendor-list.png", caption: "Vendor directory with performance ratings and payment terms." },
      { src: "screenshot-purchasing-order.png", alt: "screenshot-purchasing-order.png", caption: "Purchase order with lines, expected dates and approval history." },
    ],
    stats: [
      { label: "Active Vendors", value: "96", icon: Building2 },
      { label: "Open POs", value: "71", icon: FileStack },
      { label: "Spend MTD", value: "$410K", icon: DollarSign },
      { label: "Pending Approvals", value: "9", icon: CheckCircle2 },
    ],
    callouts: [
      { kind: "warning", text: "Never receive goods against a purchase order that is still awaiting approval — the receipt will fail three-way matching." },
    ],
    tasks: [
      {
        id: "onboard-vendor",
        title: "Onboard a vendor",
        goal: "Register a supplier so orders and invoices can be raised against them.",
        steps: [
          { title: "Create the vendor", detail: "Go to Purchasing → Vendors and select New Vendor." },
          { title: "Enter company details", detail: "Legal name, tax registration, address and primary contact." },
          { title: "Set commercial terms", detail: "Payment terms, currency, default lead time and incoterms." },
          { title: "Attach compliance documents", detail: "Upload the signed agreement and any certification the category requires." },
          { title: "Activate", detail: "Set status to Active. Only active vendors appear in purchase order entry." },
        ],
      },
      {
        id: "raise-po",
        title: "Raise a purchase order",
        goal: "Commit to buying goods at agreed prices and dates.",
        steps: [
          { title: "Start the PO", detail: "Go to Purchasing → Purchase Orders and select New PO, or accept a replenishment suggestion." },
          { title: "Select the vendor", detail: "Terms, currency and lead time default from the vendor record." },
          { title: "Add lines", detail: "Add products, quantities, unit costs and expected delivery dates." },
          { title: "Submit for approval", detail: "Select Submit. The PO routes to the approver matching its total value." },
        ],
      },
      {
        id: "approve-po",
        title: "Approve a purchase order",
        goal: "Release committed spend after checking it is justified and budgeted.",
        steps: [
          { title: "Open your approval queue", detail: "Go to Purchasing → Approvals, or use the Pending Approvals dashboard tile." },
          { title: "Review the PO", detail: "Check vendor, pricing against the last order, and the budget line." },
          { title: "Approve or return", detail: "Select Approve to release the order, or Return with a comment for the buyer to amend.", note: "Every decision is stamped with your name and time in the approval history." },
        ],
      },
      {
        id: "receive-goods",
        title: "Receive goods",
        goal: "Record what physically arrived and increase stock.",
        steps: [
          { title: "Open the PO", detail: "Find the order by number or vendor and select Receive." },
          { title: "Enter received quantities", detail: "Record actuals per line — partial receipts are allowed and leave the balance open." },
          { title: "Flag discrepancies", detail: "Mark damaged or rejected quantities so they route to quarantine instead of sellable stock." },
          { title: "Post the receipt", detail: "Select Post. Inventory balances and average cost update immediately." },
        ],
      },
      {
        id: "invoice-match",
        title: "Match an invoice to a receipt",
        goal: "Clear the vendor invoice for payment through three-way matching.",
        steps: [
          { title: "Register the invoice", detail: "Go to Purchasing → Vendor Invoices and select New Invoice, quoting the PO number." },
          { title: "Run the match", detail: "The system compares purchase order, goods receipt and invoice quantities and values." },
          { title: "Resolve exceptions", detail: "Price or quantity differences outside tolerance block the match until reviewed." },
          { title: "Approve for payment", detail: "Select Approve. The invoice moves to the payables run." },
        ],
      },
    ],
    related: ["inventory-management", "reporting-analytics"],
  },
  {
    slug: "reporting-analytics",
    title: "Reporting & Analytics",
    short: "Reporting",
    icon: BarChart3,
    description:
      "Reporting & Analytics turns transactional data into standard reports, custom views and shared dashboards. It supports ad-hoc analysis as well as scheduled distribution to stakeholders. Every report respects the record-level permissions of the user running it.",
    screenshots: [
      { src: "screenshot-reporting-library.png", alt: "screenshot-reporting-library.png", caption: "Report library grouped by module with saved and shared views." },
      { src: "screenshot-reporting-builder.png", alt: "screenshot-reporting-builder.png", caption: "Custom report builder with field picker, filters and chart preview." },
    ],
    stats: [
      { label: "Saved Reports", value: "58", icon: FileSpreadsheet },
      { label: "Scheduled Exports", value: "12", icon: CalendarClock },
      { label: "Dashboards", value: "9", icon: Gauge },
      { label: "Data Refresh", value: "15 min", icon: TrendingUp },
    ],
    callouts: [
      { kind: "tip", text: "Save a report before scheduling it. Schedules are attached to a saved view, not to an ad-hoc query." },
    ],
    tasks: [
      {
        id: "run-standard-report",
        title: "Run a standard report",
        goal: "Produce one of the shipped reports for a chosen period.",
        steps: [
          { title: "Open the report library", detail: "Go to Reporting → Library and pick a module tab." },
          { title: "Select a report", detail: "Choose, for example, Stock Valuation or Sales by Customer." },
          { title: "Set parameters", detail: "Choose the date range, warehouse or customer group, then select Run." },
          { title: "Review the output", detail: "Sort by any column, or expand a row to see the underlying transactions." },
        ],
      },
      {
        id: "build-custom-view",
        title: "Build a custom view",
        goal: "Assemble a report from the fields you actually need.",
        steps: [
          { title: "Start the builder", detail: "Go to Reporting → New Report and choose a data source." },
          { title: "Pick fields", detail: "Drag fields into Columns, and dimensions into Group by." },
          { title: "Add filters", detail: "Define conditions such as status, date range or department." },
          { title: "Save the view", detail: "Name the report and choose whether it is private or shared with a team." },
        ],
      },
      {
        id: "chart-results",
        title: "Chart the results",
        goal: "Visualise a report so trends are readable at a glance.",
        steps: [
          { title: "Switch to the Chart tab", detail: "Open a saved report and select Chart." },
          { title: "Choose a chart type", detail: "Bar for comparison, line for trend over time, pie for composition." },
          { title: "Map axes", detail: "Assign a dimension to the category axis and a measure to the value axis." },
          { title: "Pin to a dashboard", detail: "Select Pin to Dashboard to publish the chart as a widget." },
        ],
      },
      {
        id: "schedule-export",
        title: "Schedule an export",
        goal: "Deliver a report automatically without anyone logging in.",
        steps: [
          { title: "Open the saved report", detail: "Select Actions → Schedule." },
          { title: "Set frequency", detail: "Choose daily, weekly or monthly, and the time of delivery." },
          { title: "Choose format and recipients", detail: "Select PDF, Excel or CSV, and add email recipients." },
          { title: "Activate the schedule", detail: "Select Save. The next run time is shown on the report card." },
        ],
      },
      {
        id: "share-report",
        title: "Share a report with a team",
        goal: "Give colleagues access without duplicating the definition.",
        steps: [
          { title: "Open sharing", detail: "On the saved report, select Share." },
          { title: "Add users or roles", detail: "Grant View or Edit. Edit allows changing the shared definition." },
          { title: "Confirm data visibility", detail: "Recipients only see rows their own permissions allow, even on a shared report." },
        ],
      },
    ],
    related: ["dashboard-overview", "user-administration"],
  },
  {
    slug: "user-administration",
    title: "User Administration",
    short: "User Admin",
    icon: ShieldCheck,
    description:
      "User Administration controls who can enter the system and what they may do once inside. Access is granted through roles and permission sets rather than to individuals, which keeps entitlements consistent and reviewable. Every administrative change is written to an immutable audit trail.",
    screenshots: [
      { src: "screenshot-user-admin-users.png", alt: "screenshot-user-admin-users.png", caption: "User directory showing status, roles and last sign-in." },
      { src: "screenshot-user-admin-role-editor.png", alt: "screenshot-user-admin-role-editor.png", caption: "Role editor with the permission matrix by module and action." },
    ],
    stats: [
      { label: "Users", value: "128", icon: Users },
      { label: "Roles", value: "11", icon: KeyRound },
      { label: "Permission Sets", value: "42", icon: FileStack },
      { label: "MFA Adoption", value: "87%", icon: Fingerprint },
    ],
    callouts: [
      { kind: "warning", text: "Never share an account. Audit entries identify a user, so a shared login makes an action untraceable." },
    ],
    tasks: [
      {
        id: "invite-user",
        title: "Invite a user",
        goal: "Give a new colleague access with the correct starting entitlements.",
        steps: [
          { title: "Open the user directory", detail: "Go to Administration → Users and select Invite User." },
          { title: "Enter identity details", detail: "Work email, full name, department and manager." },
          { title: "Assign a starting role", detail: "Choose the role that matches the job. Roles can be changed later." },
          { title: "Send the invitation", detail: "Select Send. The user receives an email to set a password and enrol in MFA.", note: "Invitations expire after 7 days and can be resent." },
        ],
      },
      {
        id: "assign-roles",
        title: "Assign roles to a user",
        goal: "Adjust what an existing user can see and do.",
        steps: [
          { title: "Open the user record", detail: "Search the directory and select the user." },
          { title: "Edit roles", detail: "On the Access tab, add or remove roles. A user may hold more than one." },
          { title: "Review the effective permissions", detail: "The preview panel shows the combined result of all assigned roles." },
          { title: "Save", detail: "Changes apply the next time the user loads a page." },
        ],
      },
      {
        id: "create-role",
        title: "Create a custom role",
        goal: "Model a job function that the standard roles do not cover.",
        steps: [
          { title: "Start from a template", detail: "Go to Administration → Roles, select New Role and optionally copy an existing one." },
          { title: "Set the permission matrix", detail: "For each module choose View, Create, Edit, Delete and Approve." },
          { title: "Set data scope", detail: "Restrict the role to a warehouse, department or region where needed." },
          { title: "Save and assign", detail: "Save the role, then assign it to users from the directory." },
        ],
      },
      {
        id: "review-audit-trail",
        title: "Review the audit trail",
        goal: "Establish who changed what, and when.",
        steps: [
          { title: "Open the audit log", detail: "Go to Administration → Audit Log." },
          { title: "Filter the events", detail: "Narrow by user, module, action type or date range." },
          { title: "Inspect an entry", detail: "Open a row to see the before and after values of the changed record." },
          { title: "Export the evidence", detail: "Select Export to produce a CSV for auditors. The export itself is logged." },
        ],
      },
      {
        id: "security-policy",
        title: "Enforce a security policy",
        goal: "Apply organisation-wide sign-in rules.",
        steps: [
          { title: "Open security settings", detail: "Go to Administration → Security." },
          { title: "Set password rules", detail: "Minimum length, complexity and rotation period." },
          { title: "Require MFA", detail: "Enable multi-factor authentication globally or per role." },
          { title: "Configure session limits", detail: "Set idle timeout and maximum session duration, then Save." },
        ],
      },
    ],
    related: ["dashboard-overview", "reporting-analytics"],
  },
];

export function getModule(slug: string) {
  return MANUAL_MODULES.find((m) => m.slug === slug);
}

export function moduleNeighbours(slug: string) {
  const i = MANUAL_MODULES.findIndex((m) => m.slug === slug);
  return {
    prev: i > 0 ? MANUAL_MODULES[i - 1] : undefined,
    next: i >= 0 && i < MANUAL_MODULES.length - 1 ? MANUAL_MODULES[i + 1] : undefined,
  };
}