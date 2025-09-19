import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InspectionsPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;  
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  isLoading?: boolean;
}

export function InspectionsPagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: InspectionsPaginationProps) {
  const startItem = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    // Always show first page
    range.push(1);

    // Add ellipsis if there's a gap
    if (left > 2) {
      range.push("ellipsis-left");
    }

    // Add visible pages around current page
    for (let i = left; i <= right; i++) {
      if (i !== 1 && i !== totalPages) {
        range.push(i);
      }
    }

    // Add ellipsis if there's a gap
    if (right < totalPages - 1) {
      range.push("ellipsis-right");
    }

    // Always show last page (if more than 1 page)
    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range;
  };

  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {totalCount} result{totalCount === 1 ? "" : "s"}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Items per page:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(parseInt(value))}
            disabled={isLoading}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-sm text-muted-foreground">
        Showing {startItem}-{endItem} of {totalCount} results
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Items per page:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(parseInt(value))}
            disabled={isLoading}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1 && !isLoading) {
                    onPageChange(currentPage - 1);
                  }
                }}
                className={
                  currentPage <= 1 || isLoading
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>

            {getVisiblePages().map((page, index) => {
              if (typeof page === "string") {
                return (
                  <PaginationItem key={page}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }

              return (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!isLoading) {
                        onPageChange(page);
                      }
                    }}
                    isActive={page === currentPage}
                    className={isLoading ? "pointer-events-none opacity-50" : ""}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages && !isLoading) {
                    onPageChange(currentPage + 1);
                  }
                }}
                className={
                  currentPage >= totalPages || isLoading
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}