import * as React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, Calendar, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Shift, formatShiftTime, getRoleLabel } from "@/lib/shifts";
import { formatDateForDisplay } from "@/lib/date-utils";
import { SynsTypeMultiSelect } from "@/components/filters/SynsTypeMultiSelect";
import { DateRangePicker } from "@/components/filters/DateRangePicker";

interface ShiftsTableProps {
  shifts: Shift[];
  isLoading?: boolean;
  onViewDetails: (shift: Shift) => void;
}

type SortField = "inspector_name" | "department" | "type" | "date_local" | "start_utc" | "status";
type SortDirection = "asc" | "desc";

interface HeaderFilters {
  namn?: string;
  afdeling?: string;
  synstyper?: string[];
  tidspunkt?: string;
  status?: string;
  datoFrom?: string;
  datoTo?: string;
}

const STATUS_OPTIONS = ["Planlagt", "Flyttet", "Aflyst"];
const SYNS_TYPES = [
  { code: "PA", label: "Proforma" },
  { code: "PS", label: "Projektsyn" },
  { code: "IF", label: "Indflytningssyn" },
  { code: "FF", label: "Fraflytningssyn" }
];

export function ShiftsTable({
  shifts,
  isLoading = false,
  onViewDetails,
}: ShiftsTableProps) {
  const [sortField, setSortField] = React.useState<SortField>("date_local");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  const [headerFilters, setHeaderFilters] = React.useState<HeaderFilters>({});

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4" /> 
      : <ArrowDown className="h-4 w-4" />;
  };

  const updateHeaderFilter = (key: keyof HeaderFilters, value: any) => {
    setHeaderFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
  };

  // Apply filters and sorting
  const filteredAndSortedShifts = React.useMemo(() => {
    let filtered = [...shifts];

    // Apply header filters
    if (headerFilters.namn) {
      const search = headerFilters.namn.toLowerCase();
      filtered = filtered.filter(shift => 
        shift.inspector_name?.toLowerCase().includes(search)
      );
    }

    if (headerFilters.afdeling && headerFilters.afdeling !== "ALL_DEPARTMENTS") {
      filtered = filtered.filter(shift => 
        shift.department === headerFilters.afdeling
      );
    }

    if (headerFilters.synstyper?.length) {
      // Filter by selected synstyper (simple text matching)
      filtered = filtered.filter(shift => 
        headerFilters.synstyper!.some(synsType =>
          shift.type?.includes(synsType) || shift.wf_role_id?.includes(synsType.toLowerCase())
        )
      );
    }

    if (headerFilters.datoFrom) {
      filtered = filtered.filter(shift => 
        shift.date_local >= headerFilters.datoFrom!
      );
    }

    if (headerFilters.datoTo) {
      filtered = filtered.filter(shift => 
        shift.date_local <= headerFilters.datoTo!
      );
    }

    if (headerFilters.tidspunkt) {
      const search = headerFilters.tidspunkt.toLowerCase();
      filtered = filtered.filter(shift => {
        const timeStr = formatShiftTime(shift.start_utc, shift.end_utc).toLowerCase();
        return timeStr.includes(search);
      });
    }

    if (headerFilters.status && headerFilters.status !== "ALL_STATUS") {
      filtered = filtered.filter(shift => 
        shift.status === headerFilters.status
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Special handling for time sorting
      if (sortField === "start_utc") {
        aValue = a.start_utc ? new Date(a.start_utc).getTime() : 0;
        bValue = b.start_utc ? new Date(b.start_utc).getTime() : 0;
      }

      // Special handling for type sorting (convert to role label)
      if (sortField === "type") {
        aValue = getRoleLabel(a.type || a.wf_role_id);
        bValue = getRoleLabel(b.type || b.wf_role_id);
      }

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === "asc" ? 1 : -1;
      if (bValue == null) return sortDirection === "asc" ? -1 : 1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc" 
        ? (aValue < bValue ? -1 : aValue > bValue ? 1 : 0)
        : (bValue < aValue ? -1 : bValue > aValue ? 1 : 0);
    });

    return filtered;
  }, [shifts, headerFilters, sortField, sortDirection]);

  // Get unique departments for filter dropdown
  const availableDepartments = React.useMemo(() => {
    return Array.from(new Set(shifts.map(shift => shift.department))).sort();
  }, [shifts]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">Ingen planlagte vagter i det valgte interval</p>
          <p className="text-sm mt-1">
            Prøv at justere dine filtre for at se flere resultater.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {/* Main header row */}
          <TableRow className="bg-[#2F61BF] hover:bg-[#2F61BF]">
            <TableHead className="text-white font-bold">
              <Button
                variant="ghost"
                className="h-auto p-0 text-white hover:text-white hover:bg-transparent font-bold"
                onClick={() => handleSort("inspector_name")}
              >
                Navn {getSortIcon("inspector_name")}
              </Button>
            </TableHead>
            <TableHead className="text-white font-bold">
              <Button
                variant="ghost"
                className="h-auto p-0 text-white hover:text-white hover:bg-transparent font-bold"
                onClick={() => handleSort("department")}
              >
                Afdeling {getSortIcon("department")}
              </Button>
            </TableHead>
            <TableHead className="text-white font-bold">
              <Button
                variant="ghost"
                className="h-auto p-0 text-white hover:text-white hover:bg-transparent font-bold"
                onClick={() => handleSort("type")}
              >
                Synstyper {getSortIcon("type")}
              </Button>
            </TableHead>
            <TableHead className="text-white font-bold">
              <Button
                variant="ghost"
                className="h-auto p-0 text-white hover:text-white hover:bg-transparent font-bold"
                onClick={() => handleSort("date_local")}
              >
                Dato {getSortIcon("date_local")}
              </Button>
            </TableHead>
            <TableHead className="text-white font-bold">
              <Button
                variant="ghost"
                className="h-auto p-0 text-white hover:text-white hover:bg-transparent font-bold"
                onClick={() => handleSort("start_utc")}
              >
                Tidspunkt {getSortIcon("start_utc")}
              </Button>
            </TableHead>
            <TableHead className="text-white font-bold">
              <Button
                variant="ghost"
                className="h-auto p-0 text-white hover:text-white hover:bg-transparent font-bold"
                onClick={() => handleSort("status")}
              >
                Status {getSortIcon("status")}
              </Button>
            </TableHead>
            <TableHead className="text-white font-bold">Handling</TableHead>
          </TableRow>

          {/* Filter row */}
          <TableRow className="border-b-2">
            <TableHead className="p-2">
              <Input
                placeholder="Filter navn..."
                value={headerFilters.namn || ""}
                onChange={(e) => updateHeaderFilter("namn", e.target.value)}
                className="h-8"
              />
            </TableHead>
            <TableHead className="p-2">
              <Select
                value={headerFilters.afdeling || "ALL_DEPARTMENTS"}
                onValueChange={(value) => updateHeaderFilter("afdeling", value === "ALL_DEPARTMENTS" ? "" : value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_DEPARTMENTS">Alle afdelinger</SelectItem>
                  {availableDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableHead>
            <TableHead className="p-2">
              <SynsTypeMultiSelect
                synsTypes={SYNS_TYPES}
                selectedTypes={headerFilters.synstyper || []}
                onSelectionChange={(types) => updateHeaderFilter("synstyper", types)}
                placeholder="Alle"
              />
            </TableHead>
            <TableHead className="p-2">
              <div className="w-32">
                <DateRangePicker
                  dateFrom={headerFilters.datoFrom}
                  dateTo={headerFilters.datoTo}
                  onDateChange={(from, to) => {
                    updateHeaderFilter("datoFrom", from);
                    updateHeaderFilter("datoTo", to);
                  }}
                />
              </div>
            </TableHead>
            <TableHead className="p-2">
              <Input
                placeholder="Filter tid..."
                value={headerFilters.tidspunkt || ""}
                onChange={(e) => updateHeaderFilter("tidspunkt", e.target.value)}
                className="h-8"
              />
            </TableHead>
            <TableHead className="p-2">
              <Select
                value={headerFilters.status || "ALL_STATUS"}
                onValueChange={(value) => updateHeaderFilter("status", value === "ALL_STATUS" ? "" : value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_STATUS">Alle status</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableHead>
            <TableHead className="p-2"></TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {filteredAndSortedShifts.map((shift, index) => (
            <TableRow
              key={shift.id}
              className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
            >
              <TableCell className="font-medium">
                {shift.inspector_name}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {shift.department}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {getRoleLabel(shift.type || shift.wf_role_id)}
                </Badge>
              </TableCell>
              <TableCell>
                {formatDateForDisplay(shift.date_local)}
              </TableCell>
              <TableCell>
                {formatShiftTime(shift.start_utc, shift.end_utc)}
              </TableCell>
              <TableCell>
                <Badge 
                  variant={
                    shift.status === "Planlagt" ? "default" :
                    shift.status === "Flyttet" ? "secondary" : "destructive"
                  }
                >
                  {shift.status || "Planlagt"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(shift)}
                    className="h-8 px-2"
                    aria-label="Vis detaljer"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" 
                    size="sm"
                    disabled
                    className="h-8 px-2"
                    aria-label="Ombook (ikke tilgængelig)"
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="h-8 px-2"
                    aria-label="Aflys (ikke tilgængelig)"
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}