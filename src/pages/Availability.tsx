import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { AvailabilityFiltersBar } from "@/components/availability/AvailabilityFiltersBar";
import { AvailabilityTable, type AvailableInspector } from "@/components/availability/AvailabilityTable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users } from "lucide-react";

interface AvailabilityFilters {
  afdeling: string[];
  from: string;
  to: string;
  synstyper: string[];
  synstyper_all: boolean;
  q: string;
}

interface AvailabilityData {
  data: AvailableInspector[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_FILTERS: AvailabilityFilters = {
  afdeling: [],
  from: new Date().toISOString().split('T')[0],
  to: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // today + 6 days
  synstyper: ["Proforma", "Projektsyn", "Indflytningssyn", "Fraflytningssyn"],
  synstyper_all: true,
  q: "",
};

export default function AvailabilityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [filters, setFilters] = React.useState<AvailabilityFilters>(DEFAULT_FILTERS);
  const [departments, setDepartments] = React.useState<{ value: string; label: string }[]>([]);
  const [availabilityData, setAvailabilityData] = React.useState<AvailabilityData>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 500,
    totalPages: 0
  });
  const [sortBy, setSortBy] = React.useState("dato");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [isLoading, setIsLoading] = React.useState(false);

  // Load filters from URL on mount
  React.useEffect(() => {
    const urlFilters = { ...DEFAULT_FILTERS };
    
    const afdeling = searchParams.get("afdeling");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const synstyper = searchParams.get("synstyper");
    const synstyper_all = searchParams.get("synstyper_all");
    const q = searchParams.get("q");
    const page = searchParams.get("page");
    const sort = searchParams.get("sort");
    const order = searchParams.get("order");

    if (afdeling) {
      try {
        urlFilters.afdeling = JSON.parse(decodeURIComponent(afdeling));
      } catch (e) {
        // If not JSON, treat as single value for backwards compatibility
        urlFilters.afdeling = [afdeling];
      }
    }
    if (from) urlFilters.from = from;
    if (to) urlFilters.to = to;
    if (q) urlFilters.q = q;
    if (synstyper) {
      try {
        urlFilters.synstyper = JSON.parse(decodeURIComponent(synstyper));
      } catch (e) {
        console.warn("Failed to parse synstyper from URL:", e);
      }
    }
    if (synstyper_all) urlFilters.synstyper_all = synstyper_all === "true";

    setFilters(urlFilters);
    
    if (page) {
      setAvailabilityData(prev => ({ ...prev, page: parseInt(page) || 1 }));
    }
    if (sort) setSortBy(sort);
    if (order && (order === "asc" || order === "desc")) setSortOrder(order);
  }, [searchParams]);

  // Update URL when filters change
  React.useEffect(() => {
    const params = new URLSearchParams();
    
    if (filters.afdeling.length > 0) params.set("afdeling", encodeURIComponent(JSON.stringify(filters.afdeling)));
    if (filters.from !== DEFAULT_FILTERS.from) params.set("from", filters.from);
    if (filters.to !== DEFAULT_FILTERS.to) params.set("to", filters.to);
    if (filters.q) params.set("q", filters.q);
    if (!filters.synstyper_all || JSON.stringify(filters.synstyper) !== JSON.stringify(DEFAULT_FILTERS.synstyper)) {
      params.set("synstyper", encodeURIComponent(JSON.stringify(filters.synstyper)));
    }
    if (!filters.synstyper_all) params.set("synstyper_all", "false");
    
    if (availabilityData.page > 1) params.set("page", availabilityData.page.toString());
    if (sortBy !== "dato") params.set("sort", sortBy);
    if (sortOrder !== "asc") params.set("order", sortOrder);

    setSearchParams(params, { replace: true });
  }, [filters, availabilityData.page, sortBy, sortOrder, setSearchParams]);

  // Load departments on mount
  React.useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const { data } = await supabase.functions.invoke('fetch-departments');
        if (data?.data) {
          setDepartments(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch departments:", error);
      }
    };

    fetchDepartments();
  }, []);

  // Fetch availability data
  const fetchAvailability = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        from: filters.from,
        to: filters.to,
        afdeling: filters.afdeling,
        synstyper: filters.synstyper,
        synstyper_all: filters.synstyper_all,
        q: filters.q,
        page: availabilityData.page,
        pageSize: availabilityData.pageSize,
        sortBy,
        sortOrder,
      };

      const { data, error } = await supabase.functions.invoke('fetch-available-inspectors', {
        body: params
      });

      if (error) throw error;

      setAvailabilityData({
        data: data.data || [],
        total: data.total || 0,
        page: data.page || 1,
        pageSize: data.pageSize || 500,
        totalPages: data.totalPages || 0
      });
    } catch (error) {
      console.error("Failed to fetch availability:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke hente tilgængelige synskonsulenter",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [filters, availabilityData.page, availabilityData.pageSize, sortBy, sortOrder, toast]);

  // Auto-fetch on filter changes (debounced)
  React.useEffect(() => {
    const timer = setTimeout(fetchAvailability, 300);
    return () => clearTimeout(timer);
  }, [fetchAvailability]);

  const handleFiltersChange = (newFilters: AvailabilityFilters) => {
    setFilters(newFilters);
    setAvailabilityData(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handleSearch = () => {
    fetchAvailability();
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setAvailabilityData(prev => ({ ...prev, page: 1 }));
    setSortBy("dato");
    setSortOrder("asc");
  };

  const handlePageChange = (page: number) => {
    setAvailabilityData(prev => ({ ...prev, page }));
  };

  const handleSortChange = (column: string, direction: 'asc' | 'desc') => {
    setSortBy(column);
    setSortOrder(direction);
  };

  const handleSyncAvailability = async () => {
    setIsLoading(true);
    try {
      // Convert date strings to ISO format for the edge function
      const fromISO = new Date(filters.from).toISOString();
      const toISO = new Date(filters.to + 'T23:59:59').toISOString();

      toast({
        title: "Synkroniserer tilgængelighed",
        description: "Henter data fra WorkFeed...",
      });

      // Call the edge function with query parameters
      const url = `https://wtkyxxfeubpadivllowr.supabase.co/functions/v1/workfeed-ingest-availability?from=${fromISO}&to=${toISO}`;
      const session = await supabase.auth.getSession();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to sync availability: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();

      toast({
        title: "Synkronisering gennemført",
        description: `${result.upserted || 0} tilgængelighedsposter opdateret`,
      });

      // Refresh the availability data
      await fetchAvailability();
    } catch (error) {
      console.error("Failed to sync availability:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke synkronisere tilgængelighed fra WorkFeed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h1 className="page-title">Tilgængelige synskonsulenter</h1>
        </div>
        <p className="text-caption ml-16">
          Oversigt over tilgængelige synskonsulenter og deres kompetencer
        </p>
      </div>

      <AvailabilityFiltersBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        departments={departments}
        onSearch={handleSearch}
        onReset={handleReset}
        onSync={handleSyncAvailability}
        isLoading={isLoading}
      />

      <AvailabilityTable
        data={availabilityData.data}
        total={availabilityData.total}
        page={availabilityData.page}
        pageSize={availabilityData.pageSize}
        totalPages={availabilityData.totalPages}
        onPageChange={handlePageChange}
        onSortChange={handleSortChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={isLoading}
      />
    </div>
  );
}