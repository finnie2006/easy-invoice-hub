import * as React from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  value?: Date | string;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  required?: boolean;
  showClearButton?: boolean;
  dateFormat?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecteer datum",
  disabled = false,
  className,
  id,
  required,
  showClearButton = true,
  dateFormat = "dd-MM-yyyy",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Convert string to Date if needed
  const dateValue = React.useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    // Handle yyyy-MM-dd format
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    onChange(date);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateValue && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateValue ? (
            <span className="flex-1">{format(dateValue, dateFormat, { locale: nl })}</span>
          ) : (
            <span className="flex-1">{placeholder}</span>
          )}
          {showClearButton && dateValue && !disabled && (
            <X
              className="h-4 w-4 opacity-50 hover:opacity-100 ml-2"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          initialFocus
          locale={nl}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
