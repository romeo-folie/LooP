import React, { useState, useEffect, useRef } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Input } from "./ui/input";

// Generate time options once at the module level.
const TIME_OPTIONS: string[] = [];
for (let hour = 0; hour < 24; hour++) {
  for (let minute = 0; minute < 60; minute += 15) {
    const hh = hour.toString().padStart(2, "0");
    const mm = minute.toString().padStart(2, "0");
    TIME_OPTIONS.push(`${hh}:${mm}`);
  }
}

/**
 * A custom dropdown for selecting time.
 * Displays time options in 15‑minute increments.
 */
function TimeDropdown({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (time: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customTime, setCustomTime] = useState(value || "");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Ensure the scroll container is focused when opened for mouse wheel scrolling
  useEffect(() => {
    if (open && scrollContainerRef.current) {
      scrollContainerRef.current.focus();
    }
  }, [open]);

  // Validate and format custom time input
  const handleCustomTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/[^0-9:]/g, ""); // Allow only numbers and colon
    setCustomTime(input);

    // Auto-format as the user types (e.g., "123" -> "12:3" -> "12:30")
    if (input.length >= 3 && !input.includes(":")) {
      input = `${input.slice(0, 2)}:${input.slice(2)}`;
      setCustomTime(input);
    }

    // Validate and trigger onSelect if the input is a valid time
    if (input.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      onSelect(input);
    }
  };

  const handleCustomTimeBlur = () => {
    // On blur, ensure the input is a valid time or reset to the last valid value
    if (customTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      onSelect(customTime);
      setOpen(false);
    } else {
      setCustomTime(value || ""); // Revert to the last valid time if invalid
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "Enter" &&
      customTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    ) {
      onSelect(customTime);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[120px] bg-background text-foreground"
        >
          {value || "Select time"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[120px] p-0 bg-background text-foreground"
        align="start"
      >
        <div className="p-2">
          <Input
            value={customTime}
            onChange={handleCustomTimeChange}
            onBlur={handleCustomTimeBlur}
            onKeyDown={handleKeyDown}
            placeholder="HH:MM"
            className="w-full text-center"
            maxLength={5} // HH:MM format
          />
        </div>
        {/* Fixed height container with scroll enabled */}
        <div
          ref={scrollContainerRef}
          className="flex flex-col h-60 overflow-y-auto outline-none scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200"
          tabIndex={-1}
          onWheel={(e) => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop += e.deltaY;
            }
          }}
        >
          {TIME_OPTIONS.map((time) => (
            <Button
              key={time}
              variant="ghost"
              className={`justify-start px-2 hover:bg-accent ${
                value === time ? "bg-accent" : ""
              }`}
              onClick={() => {
                onSelect(time);
                setCustomTime(time); // Sync input with selected time
                setOpen(false);
              }}
            >
              {time}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DateTimePickerProps {
  value?: Date;
  onChange?: (dateTime: Date) => void;
  placeholder?: string;
}

/**
 * A combined date + custom time picker.
 * Uses shadcn’s Calendar for date selection and the custom TimeDropdown for time selection.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [internalDateTime, setInternalDateTime] = useState<Date | undefined>(
    value
  );

  const timeString = internalDateTime ? format(internalDateTime, "HH:mm") : "";

  function handleDateSelect(date: Date | undefined) {
    if (!date) return;
    let hours = 0;
    let minutes = 0;
    if (internalDateTime) {
      hours = internalDateTime.getHours();
      minutes = internalDateTime.getMinutes();
    }
    const merged = new Date(date);
    merged.setHours(hours);
    merged.setMinutes(minutes);
    setInternalDateTime(merged);
    onChange?.(merged);
  }

  function handleTimeSelect(timeVal: string) {
    const currentDate = internalDateTime
      ? new Date(internalDateTime)
      : new Date();
    const [h, m] = timeVal.split(":").map(Number);
    currentDate.setHours(h);
    currentDate.setMinutes(m);
    currentDate.setSeconds(0);
    currentDate.setMilliseconds(0);
    setInternalDateTime(currentDate);
    onChange?.(currentDate);
  }

  const displayText = internalDateTime
    ? `${format(internalDateTime, "PPP")} ${format(internalDateTime, "HH:mm")}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          {displayText}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="flex flex-col gap-4">
          <Calendar
            mode="single"
            selected={internalDateTime}
            onSelect={handleDateSelect}
          />
          <div className="flex items-center space-x-2">
            <label className="text-sm text-foreground">Time:</label>
            <TimeDropdown value={timeString} onSelect={handleTimeSelect} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
