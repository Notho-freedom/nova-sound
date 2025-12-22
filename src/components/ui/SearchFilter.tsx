"use client";

import { memo, ReactNode } from "react";
import { Search, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Button } from "./button";
import { Badge } from "./badge";
import { motion } from "framer-motion";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export const SearchBar = memo(({
  value,
  onChange,
  placeholder = "Rechercher...",
  loading = false,
  className,
  autoFocus = false,
}: SearchBarProps) => (
  <div className={cn("relative group", className)}>
    <div
      className={cn(
        "relative flex items-center rounded-xl overflow-hidden",
        "bg-muted/50 border border-border/50",
        "transition-all duration-300",
        "focus-within:border-primary/50 focus-within:bg-muted/80 focus-within:shadow-lg focus-within:shadow-primary/5"
      )}
    >
      <div className="pl-4">
        <Search
          className={cn(
            "w-5 h-5 transition-colors",
            value ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className={cn(
          "flex-1 border-0 bg-transparent py-3 text-base",
          "focus-visible:ring-0 focus-visible:ring-offset-0",
          "placeholder:text-muted-foreground/50"
        )}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className={cn(
            "mr-3 p-1.5 rounded-full",
            "hover:bg-muted transition-colors",
            "text-muted-foreground hover:text-foreground"
          )}
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {loading && (
        <div className="mr-4">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  </div>
));

SearchBar.displayName = "SearchBar";

interface FilterChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  icon?: ReactNode;
  className?: string;
}

export const FilterChip = memo(({
  label,
  active = false,
  onClick,
  onRemove,
  icon,
  className,
}: FilterChipProps) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
      "border transition-all duration-200",
      active
        ? "bg-primary/20 border-primary/50 text-primary"
        : "bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30",
      className
    )}
  >
    {icon}
    <span>{label}</span>
    {onRemove && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-1 p-0.5 rounded-full hover:bg-background/50"
      >
        <X className="w-3 h-3" />
      </button>
    )}
  </motion.button>
));

FilterChip.displayName = "FilterChip";

interface FilterBarProps {
  filters: Array<{
    id: string;
    label: string;
    active?: boolean;
    icon?: ReactNode;
  }>;
  onFilterChange: (filterId: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export const FilterBar = memo(({
  filters,
  onFilterChange,
  onClearAll,
  className,
}: FilterBarProps) => {
  const activeCount = filters.filter(f => f.active).length;

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span className="text-sm">Filtres</span>
      </div>
      
      {filters.map((filter) => (
        <FilterChip
          key={filter.id}
          label={filter.label}
          active={filter.active}
          icon={filter.icon}
          onClick={() => onFilterChange(filter.id)}
        />
      ))}
      
      {activeCount > 0 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-muted-foreground hover:text-foreground"
        >
          Effacer ({activeCount})
        </Button>
      )}
    </div>
  );
});

FilterBar.displayName = "FilterBar";

interface ViewToggleProps {
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
  className?: string;
}

export const ViewToggle = memo(({
  view,
  onViewChange,
  className,
}: ViewToggleProps) => (
  <div
    className={cn(
      "flex items-center p-1 rounded-lg bg-muted/50 border border-border/50",
      className
    )}
  >
    <button
      onClick={() => onViewChange("grid")}
      className={cn(
        "p-2 rounded-md transition-colors",
        view === "grid"
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    </button>
    <button
      onClick={() => onViewChange("list")}
      className={cn(
        "p-2 rounded-md transition-colors",
        view === "list"
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="2" width="14" height="2" rx="0.5" />
        <rect x="1" y="7" width="14" height="2" rx="0.5" />
        <rect x="1" y="12" width="14" height="2" rx="0.5" />
      </svg>
    </button>
  </div>
));

ViewToggle.displayName = "ViewToggle";

interface SortSelectProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
}

export const SortSelect = memo(({
  value,
  options,
  onChange,
  className,
}: SortSelectProps) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={cn(
      "px-3 py-2 rounded-lg text-sm",
      "bg-muted/50 border border-border/50",
      "text-foreground",
      "focus:outline-none focus:ring-2 focus:ring-primary/50",
      "transition-colors",
      className
    )}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
));

SortSelect.displayName = "SortSelect";

interface ToolbarProps {
  children: ReactNode;
  className?: string;
}

export const Toolbar = memo(({ children, className }: ToolbarProps) => (
  <div
    className={cn(
      "flex items-center justify-between gap-4 py-4 flex-wrap",
      className
    )}
  >
    {children}
  </div>
));

Toolbar.displayName = "Toolbar";

interface ResultsCountProps {
  count: number;
  label?: string;
  className?: string;
}

export const ResultsCount = memo(({
  count,
  label = "résultats",
  className,
}: ResultsCountProps) => (
  <Badge variant="secondary" className={className}>
    {count.toLocaleString()} {count > 1 ? label : label.replace(/s$/, "")}
  </Badge>
));

ResultsCount.displayName = "ResultsCount";
