"use client";

import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, Check } from "lucide-react";

export interface SearchableSelectOption {
  id: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  icon?: any;
  options: SearchableSelectOption[];
  disabled?: boolean;
  maxDisplay?: number;
  className?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  placeholder = "Select an option...",
  icon: Icon,
  options = [],
  disabled = false,
  maxDisplay = 4,
  className = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = useMemo(
    () => options.find((opt) => opt.id === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    let list = options;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(q) ||
          (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
          opt.id.toLowerCase().includes(q)
      );
    }
    return list.slice(0, maxDisplay);
  }, [options, searchQuery, maxDisplay]);

  const totalMatches = useMemo(() => {
    if (!searchQuery.trim()) return options.length;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        opt.id.toLowerCase().includes(q)
    ).length;
  }, [options, searchQuery]);

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setSearchQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={`w-full justify-between font-normal h-9 px-3 bg-background hover:bg-muted/50 border-input text-xs ${className}`}
        >
          <div className="flex items-center gap-2 truncate text-left">
            {Icon && <Icon className="size-3.5 text-muted-foreground shrink-0" />}
            <span
              className={
                selectedOption
                  ? "text-foreground font-medium truncate"
                  : "text-muted-foreground truncate"
              }
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0 shadow-lg border border-border"
        align="start"
      >
        <div className="p-2 border-b border-border/60">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search...`}
              className="h-8 pl-8 text-xs bg-muted/40 border-border/70"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1 text-xs">
          {filteredOptions.length === 0 ? (
            <div className="py-5 text-center text-xs text-muted-foreground">
              No matching records found.
            </div>
          ) : (
            <>
              {filteredOptions.map((option) => (
                <div
                  key={option.id}
                  onClick={() => {
                    onValueChange(option.id);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-md cursor-pointer text-xs transition-colors hover:bg-accent hover:text-accent-foreground ${
                    value === option.id ? "bg-accent/60 font-medium" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground font-medium">{option.label}</p>
                    {option.subLabel && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {option.subLabel}
                      </p>
                    )}
                  </div>
                  {value === option.id && (
                    <Check className="size-3.5 text-primary shrink-0" />
                  )}
                </div>
              ))}
              {totalMatches > maxDisplay && (
                <div className="px-2.5 py-1.5 text-[10px] text-center text-muted-foreground border-t border-border/40 mt-1">
                  Showing top {maxDisplay} of {totalMatches}. Type to search more.
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
