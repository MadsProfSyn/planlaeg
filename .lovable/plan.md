

## Fix Independent Scrolling for Inspector Panel on /planlaeg-syn

### Problem
The `<main>` element in `AppLayout.tsx` has `overflow-auto`, which lets the entire page scroll as one unit. Even though the two-column grid has `min-h-0`, the panels expand to full content height and scroll together.

### Fix
**1 file: `src/pages/PlanlaegSyn.tsx`**

Change the root container div (line 637) from:
```
<div className="flex flex-col h-full px-6 lg:px-8">
```
to:
```
<div className="flex flex-col h-full overflow-hidden px-6 lg:px-8">
```

Adding `overflow-hidden` prevents the page content from exceeding the viewport height, forcing each panel's internal `ScrollArea` to handle scrolling independently. The header, filters, and action buttons remain fixed at the top while both panels scroll on their own.

