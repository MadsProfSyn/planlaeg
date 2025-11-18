import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { AvailabilityFiltersBar } from "@/components/availability/AvailabilityFiltersBar";
import { AvailabilityTable, type AvailableInspector } from "@/components/availability/AvailabilityTable";
import { NoResponseTable, type NoResponseInspector } from "@/components/availability/NoResponseTable";
import { NoResponseFiltersBar } from "@/components/availability/NoResponseFiltersBar";
import { SummaryStats } from "@/components/availability/SummaryStats";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AvailabilityFilters {
  afdeling: string[];
  date: string;
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

interface NoResponseData {
  inspectors: NoResponseInspector[];
  total: number;
  responseRate: number;
}

const DEFAULT_FILTERS: AvailabilityFilters = {
  afdeling: [],
  date: new Date().toISOString().split('T')[0],
  synstyper: ["Proforma", "Projektsyn", "Indflytningssyn", "Fraflytningssyn"],
  synstyper_all: true,
  q: "",
};

export default function AvailabilityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = React.useState<"available" | "no-response">("available");
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
  
  const [noResponseData, setNoResponseData] = React.useState<NoResponseData>({
    inspectors: [],
    total: 0,
    responseRate: 0
  });
  const [noResponseFilters, setNoResponseFilters] = React.useState({
    date: new Date().toISOString().split('T')[0]
  });
  const [selectedInspectors, setSelectedInspectors] = React.useState<Set<string>>(new Set());

  // Load filters from URL on mount
  React.useEffect(() => {
    const urlFilters = { ...DEFAULT_FILTERS };
    
    const afdeling = searchParams.get("afdeling");
    const date = searchParams.get("date");
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
    if (date) urlFilters.date = date;
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
    if (filters.date !== DEFAULT_FILTERS.date) params.set("date", filters.date);
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
        from: filters.date,
        to: filters.date,
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
      const fromISO = new Date(filters.date).toISOString();
      const toISO = new Date(filters.date + 'T23:59:59').toISOString();

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

  const fetchNoResponseInspectors = React.useCallback(async (targetDate: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_availability_overview', {
        p_target_dates: [targetDate]
      });

      if (error) throw error;

      const noResponseInspectors = (data || [])
        .filter((inspector: any) => inspector.availability_status === 'NO_RESPONSE')
        .map((inspector: any) => ({
          inspector_id: inspector.inspector_id,
          inspector_name: inspector.inspector_name,
          email: inspector.email,
          phone: inspector.phone,
          department: inspector.department,
          date_local: inspector.date_local,
          availability_status: 'NO_RESPONSE' as const
        }));

      const totalInspectors = data?.length || 0;
      const noResponseCount = noResponseInspectors.length;
      const responseRate = totalInspectors > 0 
        ? ((totalInspectors - noResponseCount) / totalInspectors) * 100 
        : 0;

      setNoResponseData({
        inspectors: noResponseInspectors,
        total: totalInspectors,
        responseRate
      });
    } catch (error) {
      console.error("Failed to fetch no response data:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke hente data for ikke-responderede synskonsulenter",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (activeTab === 'no-response') {
      fetchNoResponseInspectors(noResponseFilters.date);
    }
  }, [activeTab, noResponseFilters.date, fetchNoResponseInspectors]);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h1 className="page-title">Tilgængelighed</h1>
        </div>
        <p className="text-caption ml-16">
          Oversigt over synskonsulenter og deres tilgængelighedsstatus
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "available" | "no-response")}>
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="available">
            Tilgængelige synskonsulenter
          </TabsTrigger>
          <TabsTrigger value="no-response" className="relative">
            Ikke angivet
            {noResponseData.inspectors.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {noResponseData.inspectors.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available">
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
        </TabsContent>

        <TabsContent value="no-response">
          <NoResponseFiltersBar
            selectedDate={noResponseFilters.date}
            onDateChange={(date) => setNoResponseFilters({ date })}
            onSearch={() => fetchNoResponseInspectors(noResponseFilters.date)}
            onReset={() => {
              const today = new Date().toISOString().split('T')[0];
              setNoResponseFilters({ date: today });
              fetchNoResponseInspectors(today);
            }}
            isLoading={isLoading}
          />

          <SummaryStats
            totalInspectors={noResponseData.total}
            noResponseCount={noResponseData.inspectors.length}
            responseRate={noResponseData.responseRate}
          />

          <div className="mb-4 flex justify-between items-center">
            <Button
              variant="outline"
              disabled={selectedInspectors.size === 0}
              onClick={() => {
                toast({
                  title: "Funktionen er under udvikling",
                  description: "Påmindelsesfunktionalitet kommer snart",
                });
              }}
            >
              Send påmindelse til alle ({selectedInspectors.size})
            </Button>
          </div>

          <NoResponseTable
            data={noResponseData.inspectors}
            selectedInspectors={selectedInspectors}
            onSelectionChange={setSelectedInspectors}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}