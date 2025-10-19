import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MondayItemsTable } from "@/components/inspections/MondayItemsTable";
import { InspectionsPagination } from "@/components/inspections/InspectionsPagination";
import { InspectionsFiltersBar } from "@/components/inspections/InspectionsFiltersBar";
import { getMondayItems, createMondayItem, updateMondayItem, deleteMondayItem, getRegions, type MondayItemFilters, type MondayItem } from "@/lib/supabase";
import { transformMondayItemsToInspections } from "@/lib/vrp";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Plus, Building2, Loader2 } from "lucide-react";
import { PlanlaegSynModal } from "@/components/inspections/PlanlaegSynModal";
import { MondayItemDialog } from "@/components/inspections/MondayItemDialog";
import { supabase } from "@/integrations/supabase/client";
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

export default function InspectionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [selectedRegion, setSelectedRegion] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState<string | undefined>();
  const [dateTo, setDateTo] = React.useState<string | undefined>();
  const [filters, setFilters] = React.useState<MondayItemFilters>({});
  const [isPlanningModalOpen, setIsPlanningModalOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<MondayItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);
  const [transformedInspectionIds, setTransformedInspectionIds] = React.useState<string[]>([]);
  const [isTransforming, setIsTransforming] = React.useState(false);
  const pageSize = 50;
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Initialize search query from URL
  const initialSearchQuery = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = React.useState(initialSearchQuery);

  // Fetch regions
  const { data: regions = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: getRegions,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update filters when any filter changes
  React.useEffect(() => {
    const newFilters: MondayItemFilters = {
      searchQuery: searchQuery || undefined,
      dateFrom: dateFrom,
      dateTo: dateTo,
      regions: selectedRegion !== "all" ? [selectedRegion] : undefined,
    };
    setFilters(newFilters);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [searchQuery, dateFrom, dateTo, selectedRegion]);

  // Update URL when search query changes
  React.useEffect(() => {
    if (searchQuery) {
      setSearchParams({ q: searchQuery });
    } else {
      setSearchParams({});
    }
  }, [searchQuery, setSearchParams]);

  // Fetch Monday items with filters and pagination
  const {
    data: mondayData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["monday-items", currentPage, pageSize, filters],
    queryFn: async () => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Create new abort controller
      abortControllerRef.current = new AbortController();
      
      return getMondayItems(
        currentPage,
        pageSize,
        filters,
        abortControllerRef.current.signal
      );
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Setup real-time subscription
  React.useEffect(() => {
    const channel = supabase
      .channel('monday-items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monday_items_selected'
        },
        () => {
          // Refetch data when changes occur
          queryClient.invalidateQueries({ queryKey: ["monday-items"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Handle errors
  React.useEffect(() => {
    if (error) {
      toast({
        title: "Fejl ved indlæsning",
        description: "Kunne ikke hente syn. Prøv at genindlæse siden.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleCreate = () => {
    setEditingItem(null);
    setIsEditDialogOpen(true);
  };

  const handleEdit = (item: MondayItem) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const handleSave = async (itemData: Partial<MondayItem>) => {
    try {
      if (editingItem) {
        await updateMondayItem(editingItem.id, itemData);
        toast({
          title: "Syn opdateret",
          description: "Synet er blevet opdateret.",
        });
      } else {
        await createMondayItem(itemData);
        toast({
          title: "Syn oprettet",
          description: "Nyt syn er blevet oprettet.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["monday-items"] });
      setIsEditDialogOpen(false);
    } catch (error) {
      toast({
        title: "Fejl",
        description: `Kunne ikke ${editingItem ? "opdatere" : "oprette"} syn.`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    
    try {
      await deleteMondayItem(deleteConfirmId);
      toast({
        title: "Syn slettet",
        description: "Synet er blevet slettet.",
      });
      queryClient.invalidateQueries({ queryKey: ["monday-items"] });
      setSelectedIds(prev => prev.filter(id => id !== deleteConfirmId));
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Kunne ikke slette syn.",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleOpenPlanningModal = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: "Ingen syn valgt",
        description: "Vælg mindst ét syn for at planlægge.",
        variant: "destructive",
      });
      return;
    }

    setIsTransforming(true);

    try {
      toast({
        title: "Forbereder syn",
        description: "Geocoder adresser...",
      });

      // Transform Monday items to inspection queue records (includes geocoding)
      const inspectionIds = await transformMondayItemsToInspections(selectedIds);
      
      toast({
        title: "Klar til planlægning",
        description: `${inspectionIds.length} syn er klar til rute-optimering`,
      });

      setTransformedInspectionIds(inspectionIds);
      setIsPlanningModalOpen(true);
    } catch (error) {
      toast({
        title: "Fejl",
        description:
          error instanceof Error
            ? error.message
            : "Kunne ikke forberede syn til planlægning",
        variant: "destructive",
      });
    } finally {
      setIsTransforming(false);
    }
  };

  const handlePlanningApproved = () => {
    // Clear selections after approval
    const count = selectedIds.length;
    setSelectedIds([]);
    setTransformedInspectionIds([]);
    setIsPlanningModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["monday-items"] });

    toast({
      title: "Syn planlagt",
      description: `${count} syn er blevet planlagt.`,
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleSearchClear = () => {
    setSearchQuery("");
  };

  const handleDateChange = (from?: string, to?: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const handleClearAllFilters = () => {
    setSearchQuery("");
    setSelectedRegion("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const items = mondayData?.data || [];
  const totalCount = mondayData?.count || 0;
  const totalPages = mondayData?.totalPages || 1;
  const isSearchActive = searchQuery.length >= 2;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="page-title">Syn Ikke Planlagt</h1>
            <p className="text-caption mt-1">
              Monday.com syn der venter på planlægning
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <Button onClick={handleCreate} variant="outline" size="lg" className="gap-2 border-2">
            <Plus className="h-5 w-5" />
            Tilføj Syn
          </Button>
          {selectedIds.length > 0 && (
            <Button
              onClick={handleOpenPlanningModal}
              size="lg"
              className="gap-2 shadow-md"
              disabled={isTransforming}
            >
              {isTransforming ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Forbereder...
                </>
              ) : (
                <>
                  <CalendarCheck className="h-5 w-5" />
                  Planlæg Syn ({selectedIds.length})
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm mb-6">
        <CardContent className="p-6 bg-muted/20">
          <InspectionsFiltersBar
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onSearchClear={handleSearchClear}
            regions={regions}
            selectedRegion={selectedRegion}
            onRegionChange={setSelectedRegion}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={handleDateChange}
            onClearAll={handleClearAllFilters}
            resultCount={totalCount}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Monday.com syn</span>
            <span className="text-sm font-normal text-muted-foreground">
              {isSearchActive && !isLoading
                ? `${totalCount} resultat${totalCount !== 1 ? "er" : ""}`
                : `${totalCount} syn i alt`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <MondayItemsTable
            items={items}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onEdit={handleEdit}
            onDelete={(id) => setDeleteConfirmId(id)}
            isLoading={isLoading}
            totalCount={totalCount}
          />
          
          <div className="mt-4">
            <InspectionsPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={() => {}}
              isLoading={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      <PlanlaegSynModal
        open={isPlanningModalOpen}
        onClose={() => {
          setIsPlanningModalOpen(false);
          setTransformedInspectionIds([]);
        }}
        selectedInspectionIds={transformedInspectionIds}
        onApproved={handlePlanningApproved}
      />

      <MondayItemDialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={handleSave}
        item={editingItem}
      />

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekræft sletning</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette dette syn? Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
