import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";

interface DatePickerProps {
    id?: string;
    /** ISO date string, "yyyy-MM-dd". */
    value?: string;
    onChange: (value: string | undefined) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    fromYear?: number;
    toYear?: number;
}

const DatePicker = ({ id, value, onChange, placeholder = "Pick a date", disabled, className, fromYear, toYear }: DatePickerProps) => {
    const [open, setOpen] = useState(false);

    const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
    const isValidDate = selected && !Number.isNaN(selected.getTime());

    return (
        <Popover modal open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "h-11 rounded-lg w-full justify-start font-normal border-input bg-transparent dark:bg-input/30 hover:bg-transparent dark:hover:bg-input/30",
                        !isValidDate && "text-muted-foreground",
                        className,
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                    <span className="truncate">{isValidDate ? format(selected, "dd MMM yyyy") : placeholder}</span>
                    {isValidDate && !disabled && (
                        <span
                            role="button"
                            aria-label="Clear date"
                            className="ml-auto shrink-0 opacity-60 hover:opacity-100"
                            onClick={(event) => {
                                event.stopPropagation();
                                onChange(undefined);
                            }}
                        >
                            <X className="h-4 w-4" />
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={isValidDate ? selected : undefined}
                    onSelect={(date) => {
                        onChange(date ? format(date, "yyyy-MM-dd") : undefined);
                        setOpen(false);
                    }}
                    captionLayout="dropdown"
                    startMonth={fromYear ? new Date(fromYear, 0) : new Date(1950, 0)}
                    endMonth={toYear ? new Date(toYear, 11) : new Date(new Date().getFullYear() + 10, 11)}
                    autoFocus
                />
            </PopoverContent>
        </Popover>
    );
};

export default DatePicker;
