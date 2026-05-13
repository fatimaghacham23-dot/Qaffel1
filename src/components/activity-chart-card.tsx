import * as React from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Prop definition for individual data points
interface ActivityDataPoint {
  day: string;
  value: number;
}

// Prop definition for the component
interface ActivityChartCardProps {
  title?: string;
  totalValue?: string;
  data: ActivityDataPoint[];
  className?: string;
  dropdownOptions?: string[];
  showDropdown?: boolean;
  variant?: "card" | "embed";
  emptyMessage?: string;
}

/**
 * A responsive and animated card component to display weekly activity data.
 * Features a bar chart animated with Framer Motion and supports shadcn theming.
 */
export const ActivityChartCard = ({
  title = "Activity",
  totalValue,
  data,
  className,
  dropdownOptions = ["Weekly", "Monthly", "Yearly"],
  showDropdown = false,
  variant = "card",
  emptyMessage,
}: ActivityChartCardProps) => {
  const [selectedRange, setSelectedRange] = React.useState(
    dropdownOptions[0] || ""
  );

  // Find the maximum value in the data to normalize bar heights
  const maxValue = React.useMemo(() => {
    return data.reduce((max, item) => (item.value > max ? item.value : max), 0);
  }, [data]);

  // Framer Motion variants for animations
  const chartVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1, // Animate each child (bar) with a delay
      },
    },
  };

  const barVariants = {
    hidden: { scaleY: 0, opacity: 0, transformOrigin: "bottom" },
    visible: {
      scaleY: 1,
      opacity: 1,
      transformOrigin: "bottom",
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
    },
  };

  const hasActivity = React.useMemo(() => {
    return data.some((item) => item.value > 0);
  }, [data]);

  const chartHeightPx = variant === "embed" ? 160 : 112;

  const chart = (
    <motion.div
      key={selectedRange}
      className={cn(
        "flex w-full items-end justify-between gap-2",
        variant === "embed" ? "h-40" : "h-28"
      )}
      variants={chartVariants}
      initial="hidden"
      animate="visible"
      aria-label="Activity chart"
    >
      {data.map((item, index) => (
        <div
          key={index}
          className="flex h-full w-full flex-col items-center justify-end gap-2"
          role="presentation"
        >
          <motion.div
            className={cn(
              "w-full rounded-md",
              variant === "embed" ? "bg-gradient-to-t from-teal-700 to-emerald-400" : "bg-primary"
            )}
            style={{
              height:
                item.value > 0
                  ? `${Math.max(
                      maxValue > 0 ? (item.value / maxValue) * chartHeightPx : 0,
                      8
                    )}px`
                  : "0px",
            }}
            variants={barVariants}
            aria-label={`${item.day}: ${item.value}`}
          />
          <span className="text-xs text-muted-foreground">{item.day}</span>
        </div>
      ))}
    </motion.div>
  );

  if (variant === "embed") {
    if (!hasActivity) {
      return (
        <div className={cn("w-full", className)}>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-ink">Invoice activity</p>
            <p className="mt-1 text-xs text-slate-500">Billed and collected activity from your current invoices.</p>
            <div className="mt-4 grid min-h-28 place-items-center">
              <p className="text-sm text-slate-500 italic text-center">
                {emptyMessage || "Activity appears as invoices and payments are recorded."}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("w-full", className)}>
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
          <p className="text-sm font-semibold text-ink">Invoice activity</p>
          <p className="mt-1 text-xs text-slate-500">Billed and collected activity from your current invoices.</p>
          <div className="mt-4">{chart}</div>
        </div>
      </div>
    );
  }

  return (
    <Card
      className={cn("w-full", className)}
      aria-labelledby="activity-card-title"
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle id="activity-card-title">{title}</CardTitle>
          {showDropdown ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 text-sm"
                  aria-haspopup="true"
                >
                  {selectedRange}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {dropdownOptions.map((option) => (
                  <DropdownMenuItem
                    key={option}
                    onSelect={() => setSelectedRange(option)}
                  >
                    {option}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          {/* Total Value */}
          <div className="flex flex-col">
            {totalValue ? (
              <p className="text-5xl font-bold tracking-tighter text-foreground">
                {totalValue}
              </p>
            ) : null}
          </div>

          {hasActivity ? (
            chart
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {emptyMessage || "Activity appears as invoices and payments are recorded."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};