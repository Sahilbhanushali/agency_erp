import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

export interface ComboboxOption {
    value: string;
    label: string;
}

interface ComboboxProps {
    id?: string;
    value?: string;
    onChange: (value: string) => void;
    options: ComboboxOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
    className?: string;
    /** How many options to show before the user needs to search for more. Default 5. */
    visibleCount?: number;
    /** Shown when the search has no matches, opens an inline quick-create dialog. */
    onCreateNew?: (query: string) => void;
    createLabel?: string;
    /** Shown when the search has no matches, navigates to a full create page instead. */
    createHref?: string;
}

const Combobox = ({
    id,
    value,
    onChange,
    options,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    emptyText = "No results found.",
    disabled,
    className,
    visibleCount = 5,
    onCreateNew,
    createLabel = "Add new",
    createHref,
}: ComboboxProps) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selected = options.find((option) => option.value === value);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return options.slice(0, visibleCount);
        return options.filter((option) => option.label.toLowerCase().includes(query)).slice(0, visibleCount);
    }, [options, search, visibleCount]);

    const hasMore = !search.trim() && options.length > visibleCount;

    return (
        <Popover modal open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "h-11 rounded-lg w-full justify-between font-normal border-input bg-transparent dark:bg-input/30 hover:bg-transparent dark:hover:bg-input/30",
                        !selected && "text-muted-foreground",
                        className,
                    )}
                >
                    <span className="truncate">{selected?.label ?? placeholder}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)]" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
                    <CommandList>
                        {filtered.length === 0 ? (
                            <CommandEmpty className="py-4 px-3 text-center">
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">{emptyText}</p>
                                {onCreateNew && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-lg"
                                        onClick={() => { setOpen(false); onCreateNew(search.trim()); }}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        {createLabel}
                                    </Button>
                                )}
                                {createHref && (
                                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" asChild>
                                        <Link to={createHref}>
                                            <Plus className="w-3.5 h-3.5" />
                                            {createLabel}
                                        </Link>
                                    </Button>
                                )}
                            </CommandEmpty>
                        ) : (
                            <CommandGroup>
                                {filtered.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        onSelect={() => { onChange(option.value); setOpen(false); setSearch(""); }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                                        <span className="truncate">{option.label}</span>
                                    </CommandItem>
                                ))}
                                {hasMore && (
                                    <p className="px-3 py-2 text-xs text-neutral-400 border-t border-border mt-1">
                                        Showing {visibleCount} of {options.length} — keep typing to narrow down.
                                    </p>
                                )}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default Combobox;
