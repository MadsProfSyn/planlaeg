import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlleSynTable, type AlleSynSortField, type SortDir } from "@/components/alle-syn/AlleSynTable";
import { AlleSynFiltersBar } from "@/components/alle-syn/AlleSynFiltersBar";
import { EditMondayItemDialog } from "@/components/alle-syn/EditMondayItemDialog";
import { MondayItem } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const PAGE_SIZE = 50;

export default function AlleSyn() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<MondayItem[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedRegion, setSelectedRegion] = useState(searchParams.get("region") || "");
  const [date, setDate] = useState(searchParams.get("date") || "");
  const [regions, setRegions] = useState<string[]>([]);

  const [sortField, setSortField] = useState<AlleSynSortField>(
    (searchParams.get("sort") as AlleSynSortField) || "dato_tid"
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    (searchParams.get("dir") as SortDir) || "asc"
  );

  const [editItem, setEditItem] = useState<MondayItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [knownAddresses, setKnownAddresses] = useState<Map<number, string>>(new Map());

  // Reset selection when filters/sort change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchQuery, selectedRegion, date, sortField, sortDir]);

  // Shared filter builder used by list and "select all"
  const applyFilters = useCallback(
    (query: any) => {
      let q = query.is("wf_shift_id", null);
      if (selectedRegion) q = q.eq("landsdel", selectedRegion);
      if (date) q = q.gte("dato_tid", `${date}T00:00:00`).lte("dato_tid", `${date}T23:59:59`);
      if (searchQuery && searchQuery.trim().length >= 2) {
        const words = searchQuery.trim().replace(/,/g, " ").split(/\s+/).filter((w) => w.length > 0);
        for (const word of words) {
          q = q.or(`Kunde.ilike.%${word}%,lejemalsnr.ilike.%${word}%,adresse.ilike.%${word}%,yderligere_info.ilike.%${word}%`);
        }
      }
      return q;
    },
    [selectedRegion, date, searchQuery]
  );

  // Fetch regions once
  useEffect(() => {
    supabase
      .from("monday_items_selected")
      .select("landsdel")
      .then(({ data }) => {
        const unique = Array.from(
          new Set((data || []).map((r) => r.landsdel).filter(Boolean))
        ).sort() as string[];
        setRegions(unique);
      });
  }, []);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    let query = applyFilters(
      supabase.from("monday_items_selected").select("*", { count: "exact" })
    );

    const ascending = sortDir === "asc";
    query = query
      .order(sortField, { ascending, nullsFirst: false })
      .order("inserted_at", { ascending: true })
      .range(start, end);

    const { data, error, count: total } = await query;

    if (error) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } else {
      const rows = (data || []) as MondayItem[];
      const totalCount = total || 0;
      const lastPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      if (rows.length === 0 && page > lastPage) {
        setPage(lastPage);
        return;
      }
      setItems(rows);
      setCount(totalCount);
      setKnownAddresses((prev) => {
        const next = new Map(prev);
        rows.forEach((r) => next.set(r.id, r.adresse || r.Kunde || `#${r.id}`));
        return next;
      });
    }
    setIsLoading(false);
  }, [page, applyFilters, sortField, sortDir, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.search = searchQuery;
    if (selectedRegion) params.region = selectedRegion;
    if (date) params.date = date;
    if (sortField !== "dato_tid") params.sort = sortField;
    if (sortDir !== "asc") params.dir = sortDir;
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedRegion, date, sortField, sortDir, setSearchParams]);

  const totalPages = Math.ceil(count / PAGE_SIZE);

  const hasFilters = !!searchQuery || !!selectedRegion || !!date;

  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedRegion("");
    setDate("");
    setPage(1);
  };

  const handleSort = (field: AlleSynSortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const allOnPageSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));

  const handleToggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      items.forEach((i) => (checked ? next.add(i.id) : next.delete(i.id)));
      return next;
    });
  };

  const handleSelectAllMatching = async () => {
    setSelectingAll(true);
    const { data, error } = await applyFilters(
      supabase.from("monday_items_selected").select("id")
    ).range(0, 1999);
    setSelectingAll(false);
    if (error) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      return;
    }
    setSelectedIds(new Set(((data || []) as { id: number }[]).map((r) => r.id)));
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    setBulkDeleting(true);
    let deleted = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error, count: c } = await supabase
        .from("monday_items_selected")
        .delete({ count: "exact" })
        .in("id", chunk);
      if (error) {
        toast({
          title: "Fejl ved sletning",
          description: `${error.message}${deleted ? ` (${deleted} syn blev slettet før fejlen)` : ""}`,
          variant: "destructive",
        });
        setBulkDeleting(false);
        setBulkOpen(false);
        setSelectedIds(new Set());
        fetchItems();
        return;
      }
      deleted += c ?? chunk.length;
    }
    toast({ title: "Slettet", description: `${deleted} syn er slettet` });
    setBulkDeleting(false);
    setBulkOpen(false);
    setSelectedIds(new Set());
    fetchItems();
  };

  const selectedCount = selectedIds.size;
  const selectedAddresses = Array.from(selectedIds)
    .map((id) => knownAddresses.get(id))
    .filter(Boolean) as string[];
  const shownAddresses = selectedAddresses.slice(0, 5);
  const otherCount = selectedCount - shownAddresses.length;

  const handleEdit = (item: MondayItem) => {
    setEditItem(item);
    setEditOpen(true);
  };

  const handleSave = async (id: number, updates: Partial<MondayItem>) => {
    const { error } = await supabase
      .from("monday_items_selected")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({ title: "Fejl ved gem", description: error.message, variant: "destructive" });
      throw error;
    }
    toast({ title: "Gemt", description: "Synsopdatering gemt." });
    fetchItems();
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase
      .from("monday_items_selected")
      .delete()
      .eq("id", deleteId);
    if (error) {
      toast({ title: "Fejl ved sletning", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Slettet", description: "Synsopgave er slettet." });
      fetchItems();
    }
    setDeleteOpen(false);
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Alle syn</h1>
        <p className="text-sm text-muted-foreground">Oversigt over alle synsopgaver fra Monday.com</p>
      </div>

      <AlleSynFiltersBar
        searchQuery={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
        regions={regions}
        selectedRegion={selectedRegion}
        onRegionChange={(v) => { setSelectedRegion(v); setPage(1); }}
        date={date}
        onDateChange={(v) => { setDate(v); setPage(1); }}
        onClearAll={handleClearAll}
        hasFilters={hasFilters}
        resultCount={count}
        isLoading={isLoading}
      />

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{selectedCount} valgt</span>
          {allOnPageSelected && count > items.length && selectedCount < count && (
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline disabled:opacity-50"
              onClick={handleSelectAllMatching}
              disabled={selectingAll}
            >
              {selectingAll ? "Henter…" : `Vælg alle ${count} syn, der matcher`}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Fravælg
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Slet valgte ({selectedCount})
            </Button>
          </div>
        </div>
      )}

      <AlleSynTable
        selectedIds={selectedIds}
        onToggle={handleToggle}
        onToggleAll={handleToggleAll}
        items={items}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={(id) => { setDeleteId(id); setDeleteOpen(true); }}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = startPage + i;
              if (p > totalPages) return null;
              return (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={p === page}
                    onClick={() => setPage(p)}
                    className="cursor-pointer"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <EditMondayItemDialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditItem(null); }}
        item={editItem}
        onSave={handleSave}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet synsopgave</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette denne synsopgave? Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkOpen} onOpenChange={(o) => !bulkDeleting && setBulkOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet {selectedCount} syn?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Synene fjernes fra ruteplanlæggeren. Det kan ikke fortrydes, men et syn kan sendes igen fra Monday (Til planlæg).
                </p>
                {shownAddresses.length > 0 && (
                  <ul className="list-disc pl-5 text-foreground">
                    {shownAddresses.map((a, i) => (
                      <li key={i} className="truncate">{a}</li>
                    ))}
                  </ul>
                )}
                {otherCount > 0 && <p>… og {otherCount} andre</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Annuller</AlertDialogCancel>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? "Sletter…" : `Slet ${selectedCount} syn`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
