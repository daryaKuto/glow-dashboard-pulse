import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: cn(
          "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          defaultClassNames.months
        ),
        month: cn("space-y-4", defaultClassNames.month),
        month_caption: cn(
          "flex justify-center pt-1 relative items-center",
          defaultClassNames.month_caption
        ),
        caption_label: cn(
          "text-sm font-medium",
          defaultClassNames.caption_label
        ),
        nav: cn(
          "space-x-1 flex items-center",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1",
          defaultClassNames.button_next
        ),
        table: cn("w-full border-collapse space-y-1"),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-brand-dark/70 rounded-md w-9 font-normal text-[0.8rem]",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        day: cn(
          "h-9 w-9 text-center text-sm p-0 relative " +
            "[&:has([aria-selected].day-range-end)]:rounded-r-md " +
            "[&:has([aria-selected].day-outside)]:bg-accent/50 " +
            "[&:has([aria-selected])]:bg-accent " +
            "first:[&:has([aria-selected])]:rounded-l-md " +
            "last:[&:has([aria-selected])]:rounded-r-md " +
            "focus-within:relative focus-within:z-20",
          defaultClassNames.day
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
          defaultClassNames.day_button
        ),
        range_end: cn("day-range-end", defaultClassNames.range_end),
        selected: cn(
          "bg-brand-secondary text-brand-primary-foreground " +
            "hover:bg-brand-secondary hover:text-brand-primary-foreground " +
            "focus:bg-brand-secondary focus:text-brand-primary-foreground",
          defaultClassNames.selected
        ),
        today: cn(
          "bg-accent text-accent-foreground",
          defaultClassNames.today
        ),
        outside: cn(
          "day-outside text-brand-dark/70 opacity-50 " +
            "aria-selected:bg-accent/50 aria-selected:text-brand-dark/70 " +
            "aria-selected:opacity-30",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-brand-dark/70 opacity-50",
          defaultClassNames.disabled
        ),
        range_middle: cn(
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
          defaultClassNames.range_middle
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClassName, orientation, ...chevronProps }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", chevronClassName)} {...chevronProps} />;
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("h-4 w-4", chevronClassName)} {...chevronProps} />;
          }
          return <ChevronDown className={cn("h-4 w-4", chevronClassName)} {...chevronProps} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
