"use client";

import type {
  CSSProperties,
  DragEvent,
  FormEvent,
  MouseEvent,
  PointerEvent
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  pelletInventory,
  printers,
  printRuns,
  products,
  studioTasks,
  type JobStatus,
  type PrintAssignee,
  type PrinterId,
  type PrintRun,
  type Product
} from "../data/planner-data";
import {
  loadPlannerState,
  savePlannerState,
  type StoredPlannerState
} from "../lib/planner-persistence";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DAY_HOURS = 24;
const WEEK_DAYS = 7;
const SHIPPING_BUFFER_DAYS = 3;
const PACKAGING_BUFFER_DAYS = 1;
const DEADLINE_BUFFER_DAYS = SHIPPING_BUFFER_DAYS + PACKAGING_BUFFER_DAYS;
const BASE_WEEK_START = "2026-08-03T00:00:00";
const MIN_WEEK_OFFSET = 0;
const MAX_WEEK_OFFSET = 4;
const HOURS = Array.from({ length: DAY_HOURS }, (_, hour) => hour);
const HOUR_LINES = Array.from({ length: DAY_HOURS + 1 }, (_, hour) => hour);

function getVisibleProducts(productList: Product[]) {
  return [...productList].sort((a, b) => {
  const getSortGroup = (product: Product) =>
    product.id.startsWith("bench") || product.id.startsWith("banana") ? 1 : 0;

  return getSortGroup(a) - getSortGroup(b);
  });
}

const statusLabels = {
  planned: "planned",
  printing: "printing",
  finished: "done",
  failed: "failed",
  reprint: "reprint"
};

const printStarters: Array<{ id: PrintAssignee; label: string; initial: string }> = [
  { id: "manu", label: "manu", initial: "m" },
  { id: "julian", label: "julian", initial: "j" },
  { id: "saqib", label: "saqib", initial: "s" }
];

const starterById = new Map(printStarters.map((starter) => [starter.id, starter]));

type TimelineKind = "custom" | "deadline" | "event" | "ooo" | "social media" | "task";

const initialTimelineEvents = [
  {
    id: "shorty-giveaway",
    title: "shorty giveaway",
    startDateTime: "2026-08-03T00:00:00",
    endDateTime: "2026-08-09T23:59:00",
    type: "social media"
  }
] as const;

type ProductStyle = CSSProperties & {
  "--product-color": string;
  "--product-border": string;
};

type SegmentStyle = ProductStyle & {
  "--day-index": number;
  "--drag-x"?: string;
  "--drag-y"?: string;
  "--duration-hours": string;
  "--lane-count": number;
  "--lane-index": number;
  "--start-hour": string;
};

type PreviewStyle = ProductStyle & {
  "--preview-hours": string;
};

type CurrentTimeStyle = CSSProperties & {
  "--day-index": number;
  "--start-hour": string;
};

type TimelineStyle = CSSProperties & {
  "--event-color": string;
  "--timeline-left": string;
  "--timeline-top": string;
  "--timeline-width": string;
};

type DragState = {
  deltaX: number;
  deltaY: number;
  grabOffsetX: number;
  grabOffsetY: number;
  runId: string;
  pointerId: number;
  startX: number;
  startY: number;
  hasMoved: boolean;
};

type Notice = {
  title: string;
  body: string;
};

type NativeDragPayload =
  | {
      grabOffsetX: number;
      grabOffsetY: number;
      kind: "run";
      runId: string;
    }
  | {
      grabOffsetX: number;
      grabOffsetY: number;
      kind: "new-print";
    };

type PendingWeekendAction =
  | {
      form: NewPrintForm;
      kind: "add";
    }
  | {
      form: NewPrintForm;
      kind: "edit";
      runId: string;
    }
  | {
      kind: "move";
      printerId: PrinterId;
      runId: string;
      startDateTime: string;
    }
  | {
      form: NewPrintForm;
      kind: "drop-new-print";
    };

type PendingDelete =
  | {
      kind: "print";
      label: string;
      runId: string;
    }
  | {
      eventId: string;
      kind: "event";
      label: string;
    };

type NewEventForm = {
  customColor: string;
  customLabel: string;
  endDate: string;
  startDate: string;
  title: string;
  type: TimelineKind;
};

type TimelineEvent = {
  color?: string;
  deadlineProject?: string;
  endDateTime: string;
  id: string;
  startDateTime: string;
  tagLabel?: string;
  title: string;
  type: TimelineKind;
};

type TimelineEntry = TimelineEvent & {
  end: Date;
  start: Date;
};

type ScheduledRun = {
  run: PrintRun;
  product: Product;
  start: Date;
  end: Date;
};

type CalendarSegment = ScheduledRun & {
  dayIndex: number;
  durationHours: number;
  lane: number;
  laneCount: number;
  segmentEnd: Date;
  segmentStart: Date;
  startsBeforeSegment: boolean;
  continuesAfterSegment: boolean;
  topHours: number;
};

type NewPrintForm = {
  assignee: PrintAssignee | "";
  customerDeadline: string;
  date: string;
  printerId: PrinterId;
  productId: Product["id"];
  project: string;
  status: JobStatus;
  time: string;
};

type ProductInventoryRow = Product & {
  baseStockCount: number;
  stockCount: number;
};

type NewProductForm = {
  color: string;
  name: string;
  pelletUsageKg: string;
  printDurationHours: string;
};

function asDate(value: string) {
  return new Date(value);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * HOUR_MS);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function getDayStart(date: Date) {
  const dayStart = new Date(date);

  dayStart.setHours(0, 0, 0, 0);

  return dayStart;
}

function getLaterDate(a: Date, b: Date) {
  return a > b ? a : b;
}

function getEarlierDate(a: Date, b: Date) {
  return a < b ? a : b;
}

function getHoursBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / HOUR_MS;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateTimeValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${formatDateInput(date)}T${hours}:${minutes}:00`;
}

function formatDateTimeInputDate(value: string) {
  return value.slice(0, 10);
}

function formatDateTimeInputTime(value: string) {
  return value.slice(11, 16);
}

function formatTimeInput(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function formatCompactDate(date: Date) {
  return `${date.getDate()}.${date.getMonth() + 1}.`;
}

function formatDayHeading(date: Date) {
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });

  return `${weekday}, ${formatCompactDate(date)}`;
}

function formatShortDayHeading(date: Date) {
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return `${weekdays[date.getDay()]}, ${formatCompactDate(date)}`;
}

function formatHours(hours: number) {
  return `${hours.toLocaleString("en", { maximumFractionDigits: 1 })}h`;
}

function formatHourLabel(hour: number) {
  return String(hour);
}

function formatPrinterName(printer: { name: string }) {
  return `Printer ${printer.name.padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snapToHalfHour(hours: number) {
  return clamp(Math.round(hours * 2) / 2, 0, DAY_HOURS - 0.5);
}

function getProductStyle(product: Product): ProductStyle {
  return {
    "--product-color": product.color,
    "--product-border": product.borderColor
  };
}

function getProductIdFromName(name: string, existingProducts: Product[]) {
  const baseId =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `product-${Date.now()}`;
  const existingIds = new Set(existingProducts.map((product) => product.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let index = 2;

  while (existingIds.has(`${baseId}-${index}`)) {
    index += 1;
  }

  return `${baseId}-${index}`;
}

function getPreviewStyle(product: Product): PreviewStyle {
  return {
    "--preview-hours": product.printDurationHours.toFixed(2),
    ...getProductStyle(product)
  };
}

function getEndDate(run: PrintRun, product: Product) {
  return addHours(asDate(run.startDateTime), product.printDurationHours);
}

function getLatestPrintCompletion(run: PrintRun) {
  if (!run.customerDeadline || run.skipDeadlineBuffer) {
    return null;
  }

  return addDays(asDate(run.customerDeadline), -DEADLINE_BUFFER_DAYS);
}

function getLatestSafeStart(run: PrintRun, product: Product) {
  const latestPrintCompletion = getLatestPrintCompletion(run);

  if (!latestPrintCompletion) {
    return null;
  }

  return addHours(latestPrintCompletion, -product.printDurationHours);
}

function getCardDeadlineDate(run: PrintRun, product: Product) {
  if (!run.customerDeadline) {
    return null;
  }

  return getLatestSafeStart(run, product) ?? asDate(run.customerDeadline);
}

function getWeekStart(weekOffset: number) {
  return addDays(asDate(BASE_WEEK_START), weekOffset * WEEK_DAYS);
}

function getWeekEnd(weekStart: Date) {
  return addDays(weekStart, WEEK_DAYS);
}

function intersectsWeek(run: PrintRun, product: Product, weekStart: Date) {
  const start = asDate(run.startDateTime);
  const end = getEndDate(run, product);
  const weekEnd = getWeekEnd(weekStart);

  return start < weekEnd && end > weekStart;
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getWeekDays(weekStart: Date) {
  return Array.from({ length: WEEK_DAYS }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      date,
      label: formatDayHeading(date),
      shortLabel: formatShortDayHeading(date)
    };
  });
}

function getScheduledRuns(runs: PrintRun[], productMap: Map<string, Product>) {
  return runs
    .map((run) => {
      const product = productMap.get(run.productId);

      if (!product) {
        return null;
      }

      return {
        run,
        product,
        start: asDate(run.startDateTime),
        end: getEndDate(run, product)
      };
    })
    .filter((entry): entry is ScheduledRun => entry !== null);
}

function getRunsForPrinter(
  printerId: PrinterId,
  weekStart: Date,
  runs: PrintRun[],
  productMap: Map<string, Product>
) {
  return getScheduledRuns(runs, productMap)
    .filter(
      (entry) =>
        entry.run.printerId === printerId &&
        intersectsWeek(entry.run, entry.product, weekStart)
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function buildSegmentsForRun(entry: ScheduledRun, weekStart: Date) {
  const weekEnd = getWeekEnd(weekStart);

  return Array.from({ length: WEEK_DAYS }, (_, dayIndex) => {
    const dayStart = addDays(weekStart, dayIndex);
    const dayEnd = addDays(dayStart, 1);
    const segmentStart = getLaterDate(entry.start, dayStart);
    const segmentEnd = getEarlierDate(entry.end, getEarlierDate(dayEnd, weekEnd));

    if (segmentStart >= segmentEnd) {
      return null;
    }

    return {
      ...entry,
      dayIndex,
      durationHours: getHoursBetween(segmentStart, segmentEnd),
      lane: 0,
      laneCount: 1,
      segmentEnd,
      segmentStart,
      startsBeforeSegment: entry.start < segmentStart,
      continuesAfterSegment: entry.end > segmentEnd,
      topHours: getHoursBetween(dayStart, segmentStart)
    };
  }).filter((segment): segment is CalendarSegment => segment !== null);
}

function layoutSegments(segments: CalendarSegment[]) {
  const segmentsByDay = Array.from({ length: WEEK_DAYS }, () => [] as CalendarSegment[]);

  segments.forEach((segment) => {
    segmentsByDay[segment.dayIndex].push(segment);
  });

  return segmentsByDay.flatMap((daySegments) => {
    const laneEnds: number[] = [];
    const withLanes = [...daySegments]
      .sort((a, b) => a.topHours - b.topHours || a.durationHours - b.durationHours)
      .map((segment) => {
        let lane = laneEnds.findIndex((end) => end <= segment.topHours);

        if (lane === -1) {
          lane = laneEnds.length;
        }

        laneEnds[lane] = segment.topHours + segment.durationHours;

        return {
          ...segment,
          lane
        };
      });
    const laneCount = Math.max(laneEnds.length, 1);

    return withLanes.map((segment) => ({
      ...segment,
      laneCount
    }));
  });
}

function layoutRuns(
  runs: PrintRun[],
  printerId: PrinterId,
  weekStart: Date,
  productMap: Map<string, Product>
) {
  const printerRuns = getRunsForPrinter(printerId, weekStart, runs, productMap);
  const segments = layoutSegments(
    printerRuns.flatMap((entry) => buildSegmentsForRun(entry, weekStart))
  );

  return {
    runCount: printerRuns.length,
    segments
  };
}

function getWeekRuns(
  weekStart: Date,
  runs: PrintRun[],
  productMap: Map<string, Product>
) {
  return getScheduledRuns(runs, productMap).filter((entry) =>
    intersectsWeek(entry.run, entry.product, weekStart)
  );
}

function getPlannedPelletUsageKg(
  runs: PrintRun[],
  from: Date,
  days: number,
  productMap: Map<string, Product>
) {
  const rangeEnd = addDays(from, days);

  return getScheduledRuns(runs, productMap).reduce((sum, entry) => {
    const run = entry.run;
    const product = productMap.get(run.productId);

    if (
      !product ||
      run.status === "finished" ||
      run.status === "failed" ||
      entry.end <= from ||
      entry.start >= rangeEnd
    ) {
      return sum;
    }

    return sum + product.pelletUsageKg;
  }, 0);
}

function getReorderDate(
  runs: PrintRun[],
  from: Date,
  days: number,
  currentStockKg: number,
  productMap: Map<string, Product>
) {
  const rangeEnd = addDays(from, days);
  let projectedStock = currentStockKg;

  if (projectedStock <= pelletInventory.reorderThresholdKg) {
    return from;
  }

  const plannedRuns = getScheduledRuns(runs, productMap)
    .filter(
      (entry) =>
        entry.run.status !== "finished" &&
        entry.run.status !== "failed" &&
        entry.end > from &&
        entry.start < rangeEnd
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const entry of plannedRuns) {
    projectedStock -= entry.product.pelletUsageKg;

    if (projectedStock <= pelletInventory.reorderThresholdKg) {
      return entry.start;
    }
  }

  return null;
}

function getProductInventory(
  runs: PrintRun[],
  now: Date,
  manualStock: Record<string, number>,
  productList: Product[],
  productMap: Map<string, Product>
): ProductInventoryRow[] {
  const completedCounts = new Map<Product["id"], number>();

  getScheduledRuns(runs, productMap).forEach((entry) => {
    if (entry.end <= now && entry.run.status !== "failed") {
      completedCounts.set(
        entry.product.id,
        (completedCounts.get(entry.product.id) ?? 0) + 1
      );
    }
  });

  return getVisibleProducts(productList).map((product) => ({
    ...product,
    baseStockCount: manualStock[product.id] ?? 0,
    stockCount: (manualStock[product.id] ?? 0) + (completedCounts.get(product.id) ?? 0)
  }));
}

function buildStartDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function createDefaultPrintForm(weekStart: Date): NewPrintForm {
  return {
    assignee: "",
    customerDeadline: "",
    date: formatDateInput(addDays(weekStart, 2)),
    printerId: "printer-2",
    productId: "len",
    project: "",
    status: "planned",
    time: "10:00"
  };
}

function createDefaultEventForm(weekStart: Date): NewEventForm {
  return {
    customColor: "#d65454",
    customLabel: "",
    endDate: formatDateInput(addDays(weekStart, 6)),
    startDate: formatDateInput(weekStart),
    title: "",
    type: "event"
  };
}

function buildCandidateRun(form: NewPrintForm, id = "candidate"): PrintRun {
  return {
    id,
    assignee: form.assignee || undefined,
    productId: form.productId,
    project: form.project.trim(),
    printerId: form.printerId,
    startDateTime: buildStartDateTime(form.date, form.time),
    status: form.status,
    priority: form.status === "reprint" ? "urgent" : "normal",
    customerDeadline: form.customerDeadline
      ? buildStartDateTime(form.customerDeadline, "18:00")
      : undefined
  };
}

function getPendingWeekendStart(action: PendingWeekendAction) {
  if (action.kind === "move") {
    return asDate(action.startDateTime);
  }

  return asDate(buildStartDateTime(action.form.date, action.form.time));
}

function findPrintConflict(
  candidate: PrintRun,
  runs: PrintRun[],
  productMap: Map<string, Product>
) {
  const product = productMap.get(candidate.productId);

  if (!product) {
    return null;
  }

  const candidateStart = asDate(candidate.startDateTime);
  const candidateEnd = getEndDate(candidate, product);

  return getScheduledRuns(runs, productMap).find((entry) => {
    return (
      entry.run.printerId === candidate.printerId &&
      entry.run.id !== candidate.id &&
      candidateStart < entry.end &&
      candidateEnd > entry.start
    );
  });
}

function buildEditForm(run: PrintRun): NewPrintForm {
  return {
    assignee: run.assignee ?? "",
    customerDeadline: run.customerDeadline ? formatDateTimeInputDate(run.customerDeadline) : "",
    date: formatDateTimeInputDate(run.startDateTime),
    printerId: run.printerId,
    productId: run.productId,
    project: run.project,
    status: run.status,
    time: formatDateTimeInputTime(run.startDateTime)
  };
}

function buildEventForm(event: TimelineEvent): NewEventForm {
  return {
    customColor: event.color ?? "#bd8a1d",
    customLabel: event.tagLabel ?? "",
    endDate: formatDateTimeInputDate(event.endDateTime),
    startDate: formatDateTimeInputDate(event.startDateTime),
    title: event.title,
    type: event.type
  };
}

function getNextWorkday(date: Date) {
  let next = addDays(date, 1);

  while (isWeekend(next)) {
    next = addDays(next, 1);
  }

  return next;
}

function roundUpToHalfHour(date: Date) {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const nextMinutes = Math.ceil(minutes / 30) * 30;

  rounded.setSeconds(0, 0);

  if (nextMinutes >= 60) {
    rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  } else {
    rounded.setMinutes(nextMinutes);
  }

  return rounded;
}

function getDefaultNewPrintStart(weekStart: Date, now: Date) {
  const weekDefault = addHours(addDays(weekStart, 2), 10);
  let nextStart = weekDefault > now ? weekDefault : roundUpToHalfHour(now);

  if (isWeekend(nextStart)) {
    nextStart = getNextWorkday(nextStart);
    nextStart.setHours(10, 0, 0, 0);
  }

  return nextStart;
}

function getRunActionLabels(entry: ScheduledRun, now: Date) {
  if (entry.run.status === "failed" || entry.run.status === "finished") {
    return [];
  }

  if (entry.run.status === "printing") {
    return ["print okay?", "print not okay?"];
  }

  if (entry.end <= now) {
    return [];
  }

  if ((entry.run.status === "planned" || entry.run.status === "reprint") && entry.start <= now) {
    return ["print started"];
  }

  return [];
}

function getSegmentStyle(segment: CalendarSegment): SegmentStyle {
  return {
    "--day-index": segment.dayIndex,
    "--duration-hours": segment.durationHours.toFixed(2),
    "--lane-count": segment.laneCount,
    "--lane-index": segment.lane,
    "--start-hour": segment.topHours.toFixed(2),
    ...getProductStyle(segment.product)
  };
}

function getProgress(entry: ScheduledRun, now: Date) {
  if (entry.run.status !== "printing") {
    return null;
  }

  if (entry.run.progressPercent !== undefined) {
    return Math.min(Math.max(entry.run.progressPercent, 0), 100);
  }

  if (now <= entry.start) {
    return 0;
  }

  if (now >= entry.end) {
    return 100;
  }

  return Math.round(
    ((now.getTime() - entry.start.getTime()) / (entry.end.getTime() - entry.start.getTime())) *
      100
  );
}

function buildRunTitle(entry: ScheduledRun) {
  const latestSafeStart = getLatestSafeStart(entry.run, entry.product);
  const deadline = entry.run.customerDeadline ? asDate(entry.run.customerDeadline) : null;
  const starter = entry.run.assignee ? starterById.get(entry.run.assignee) : null;

  return [
    entry.product.name,
    entry.run.project,
    starter ? `starter ${starter.label}` : null,
    `start ${formatCompactDate(entry.start)} ${formatTime(entry.start)}`,
    `end ${formatCompactDate(entry.end)} ${formatTime(entry.end)}`,
    `duration ${formatHours(entry.product.printDurationHours)}`,
    deadline ? `deadline ${formatCompactDate(deadline)} ${formatTime(deadline)}` : null,
    latestSafeStart
      ? `print deadline ${formatCompactDate(latestSafeStart)} ${formatTime(latestSafeStart)}`
      : null
  ]
    .filter(Boolean)
    .join(" / ");
}

function getSegmentLabel(segment: CalendarSegment, now: Date) {
  if (segment.run.status === "finished") {
    return "done";
  }

  if (segment.run.status === "failed") {
    return "failed";
  }

  if (
    segment.end <= now &&
    (segment.run.status === "planned" || segment.run.status === "reprint")
  ) {
    return "done";
  }

  if (segment.startsBeforeSegment) {
    return "continued";
  }

  return statusLabels[segment.run.status];
}

function shouldShowStatusPill(label: string) {
  return label !== "planned";
}

function getTimeRangeLabel(entry: ScheduledRun) {
  const sameDay = entry.start.toDateString() === entry.end.toDateString();

  if (sameDay) {
    return `${formatTime(entry.start)}-${formatTime(entry.end)}`;
  }

  return `${formatCompactDate(entry.start)} ${formatTime(entry.start)} - ${formatCompactDate(
    entry.end
  )} ${formatTime(entry.end)}`;
}

function getProjectLabel(run: PrintRun) {
  return [run.project, run.sequence].filter(Boolean).join(" · ");
}

function getCompactProjectLabel(run: PrintRun) {
  return [run.project, run.sequence].filter(Boolean).join(" ");
}

function canShowCompactProject(segment: CalendarSegment) {
  return (
    segment.durationHours >= 4.5 &&
    !segment.product.id.startsWith("banana") &&
    Boolean(segment.run.project)
  );
}

function isDateInWeek(date: Date, weekStart: Date) {
  return date >= weekStart && date < getWeekEnd(weekStart);
}

function getCurrentTimeStyle(now: Date, weekStart: Date): CurrentTimeStyle {
  const dayIndex = Math.floor(getHoursBetween(weekStart, now) / DAY_HOURS);
  const dayStart = addDays(weekStart, dayIndex);

  return {
    "--day-index": dayIndex,
    "--start-hour": getHoursBetween(dayStart, now).toFixed(2)
  };
}

function getTimelineEntries(
  runs: PrintRun[],
  events: TimelineEvent[],
  weekStart: Date,
  productMap: Map<string, Product>
): TimelineEntry[] {
  const weekEnd = getWeekEnd(weekStart);
  const deadlines = new Map<string, TimelineEvent>();

  getScheduledRuns(runs, productMap).forEach((entry) => {
    if (!entry.run.customerDeadline) {
      return;
    }

    const deadline = asDate(entry.run.customerDeadline);

    if (deadline < weekStart || deadline >= weekEnd) {
      return;
    }

    const key = `${formatDateInput(deadline)}-${entry.run.project}`;

    if (!deadlines.has(key)) {
      deadlines.set(key, {
        deadlineProject: entry.run.project,
        endDateTime: formatDateTimeValue(addHours(deadline, 4)),
        id: `deadline-${key}`,
        startDateTime: entry.run.customerDeadline,
        title: `deadline ${entry.run.project}`,
        type: "deadline"
      });
    }
  });

  const taskEvents = studioTasks.map((task) => ({
    endDateTime: task.dueDateTime,
    id: `task-${task.id}`,
    startDateTime: task.dueDateTime,
    title: task.title,
    type: "ooo" as const
  }));

  return [...events, ...taskEvents, ...deadlines.values()]
    .map((event) => ({
      ...event,
      end: asDate(event.endDateTime),
      start: asDate(event.startDateTime)
    }))
    .filter((event) => event.start < weekEnd && event.end >= weekStart)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function getTimelineColor(entry: TimelineEvent) {
  const colors: Record<TimelineKind, string> = {
    custom: entry.color ?? "#d65454",
    deadline: "#d65454",
    event: "#898cd6",
    ooo: "#c8c4be",
    "social media": "#fac7c2",
    task: "#b3c3b2"
  };

  return entry.color ?? colors[entry.type];
}

function getTimelineStyle(entry: TimelineEntry, weekStart: Date, index: number): TimelineStyle {
  const weekEnd = getWeekEnd(weekStart);
  const visibleStart =
    entry.type === "deadline"
      ? getLaterDate(getDayStart(entry.start), weekStart)
      : getLaterDate(entry.start, weekStart);
  const visibleEnd = getEarlierDate(entry.end, weekEnd);
  const left =
    entry.type === "deadline"
      ? ((visibleStart.getTime() - weekStart.getTime()) / (WEEK_DAYS * DAY_MS)) * 100 + 0.5
      : ((visibleStart.getTime() - weekStart.getTime()) / (WEEK_DAYS * DAY_MS)) * 100;
  const typeTop: Record<TimelineKind, number> = {
    custom: 12,
    deadline: 44 + (index % 2) * 34,
    event: 12,
    ooo: 112,
    "social media": 12,
    task: 112
  };
  const width = Math.max(
    ((visibleEnd.getTime() - visibleStart.getTime()) / (WEEK_DAYS * DAY_MS)) * 100,
    entry.type === "deadline" ? 9 : 5
  );

  return {
    "--event-color": getTimelineColor(entry),
    "--timeline-left": `${left}%`,
    "--timeline-top": `${typeTop[entry.type]}px`,
    "--timeline-width": entry.type === "deadline" ? "12.8%" : `${width}%`
  };
}

function getTimelineTypeClass(type: TimelineKind) {
  return `type-${type.replace(/\s+/g, "-")}`;
}

function getTimelineLabel(entry: TimelineEntry) {
  if (entry.type === "deadline") {
    return <span>{entry.title.replace(/^deadline\s+/i, "")}</span>;
  }

  return <span>{entry.title}</span>;
}

function getDropStartFromBoard(
  board: HTMLElement,
  clientX: number,
  clientY: number,
  weekStart: Date
) {
  const printerId = board.dataset.printerId as PrinterId | undefined;

  if (!printerId) {
    return null;
  }

  const rect = board.getBoundingClientRect();
  const dayWidth = rect.width / WEEK_DAYS;
  const dayIndex = clamp(Math.floor((clientX - rect.left) / dayWidth), 0, WEEK_DAYS - 1);
  const startHour = snapToHalfHour(((clientY - rect.top) / rect.height) * DAY_HOURS);
  const start = addHours(addDays(weekStart, dayIndex), startHour);

  return {
    printerId,
    start
  };
}

export function WeekPlanner() {
  const [runs, setRuns] = useState<PrintRun[]>(printRuns);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [editPrint, setEditPrint] = useState<NewPrintForm | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editEvent, setEditEvent] = useState<NewEventForm | null>(null);
  const [selectedDeadline, setSelectedDeadline] = useState<{
    originalDate: string;
    project: string;
  } | null>(null);
  const [editDeadlineDate, setEditDeadlineDate] = useState("");
  const [pendingStartRunId, setPendingStartRunId] = useState<string | null>(null);
  const [showInventoryPopup, setShowInventoryPopup] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pendingWeekendAction, setPendingWeekendAction] =
    useState<PendingWeekendAction | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([
    ...initialTimelineEvents
  ]);
  const [isEventOpen, setIsEventOpen] = useState(false);
  const [newPrint, setNewPrint] = useState<NewPrintForm>(() =>
    createDefaultPrintForm(asDate(BASE_WEEK_START))
  );
  const [newEvent, setNewEvent] = useState<NewEventForm>(() =>
    createDefaultEventForm(asDate(BASE_WEEK_START))
  );
  const [productData, setProductData] = useState<Product[]>(products);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProductForm>({
    color: "#d3d0cb",
    name: "",
    pelletUsageKg: "",
    printDurationHours: ""
  });
  const [materialStockKg, setMaterialStockKg] = useState(pelletInventory.currentStockKg);
  const [isMaterialAddOpen, setIsMaterialAddOpen] = useState(false);
  const [materialAddKg, setMaterialAddKg] = useState("");
  const [isMaterialEditOpen, setIsMaterialEditOpen] = useState(false);
  const [materialEditKg, setMaterialEditKg] = useState("");
  const [manualProductInventory, setManualProductInventory] = useState<
    Record<string, number>
  >({});
  const [editingInventoryProductId, setEditingInventoryProductId] = useState<string | null>(
    null
  );
  const [editingProductDataId, setEditingProductDataId] = useState<string | null>(null);
  const [savedInventoryProductId, setSavedInventoryProductId] = useState<string | null>(
    null
  );
  const [savedProductDataId, setSavedProductDataId] = useState<string | null>(null);
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => new Date());
  const [isPlannerLoaded, setIsPlannerLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const nativeDragRef = useRef<NativeDragPayload | null>(null);
  const remoteUpdatedAtRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const skipNextSaveRef = useRef(true);
  const suppressClickRunId = useRef<string | null>(null);
  const weekStart = getWeekStart(weekOffset);
  const weekDays = getWeekDays(weekStart);
  const productById = useMemo(
    () => new Map(productData.map((product) => [product.id, product])),
    [productData]
  );
  const visibleProducts = useMemo(() => getVisibleProducts(productData), [productData]);
  const plannedPelletUsageKg = getPlannedPelletUsageKg(runs, now, 14, productById);
  const projectedStockKg = materialStockKg - plannedPelletUsageKg;
  const reorderDate = getReorderDate(runs, now, 14, materialStockKg, productById);
  const reorderMessage = reorderDate
    ? `reorder by ${formatCompactDate(reorderDate)} to avoid delays`
    : "no reorder needed next 2 weeks";
  const isMaterialCritical = reorderDate !== null;
  const inventoryRows = getProductInventory(
    runs,
    now,
    manualProductInventory,
    productData,
    productById
  );
  const currentTimeStyle = isDateInWeek(now, weekStart)
    ? getCurrentTimeStyle(now, weekStart)
    : null;
  const canGoBack = weekOffset > MIN_WEEK_OFFSET;
  const canGoForward = weekOffset < MAX_WEEK_OFFSET;
  const selectedNewProduct = productById.get(newPrint.productId) ?? productData[0];
  const candidateRun = buildCandidateRun(newPrint);
  const candidateStart = asDate(candidateRun.startDateTime);
  const candidateEnd = getEndDate(candidateRun, selectedNewProduct);
  const conflict = findPrintConflict(candidateRun, runs, productById);
  const hasWeekendStart = isWeekend(candidateStart);
  const hasPastStart = candidateStart < now;
  const canAddPrint = newPrint.project.trim().length > 0 && !conflict && !hasPastStart;
  const selectedRun = selectedRunId ? runs.find((run) => run.id === selectedRunId) : null;
  const selectedProduct = selectedRun ? productById.get(selectedRun.productId) : null;
  const editCandidate =
    selectedRun && editPrint ? buildCandidateRun(editPrint, selectedRun.id) : null;
  const editProduct = editPrint ? productById.get(editPrint.productId) ?? productData[0] : null;
  const editStart = editCandidate ? asDate(editCandidate.startDateTime) : null;
  const editEnd = editCandidate && editProduct ? getEndDate(editCandidate, editProduct) : null;
  const editConflict = editCandidate
    ? findPrintConflict(editCandidate, runs, productById)
    : null;
  const editWeekendStart = editStart ? isWeekend(editStart) : false;
  const canSaveEdit =
    Boolean(selectedRun && editPrint && editPrint.project.trim()) && !editConflict;
  const selectedEvent = selectedEventId
    ? timelineEvents.find((event) => event.id === selectedEventId)
    : null;
  const canSaveEventEdit = Boolean(selectedEvent && editEvent?.title.trim());
  const canSaveDeadlineEdit = Boolean(selectedDeadline && editDeadlineDate);
  const timelineEntries = getTimelineEntries(runs, timelineEvents, weekStart, productById);
  const pendingStartRun = pendingStartRunId
    ? runs.find((run) => run.id === pendingStartRunId)
    : null;

  async function hydratePlannerState() {
    setLoadError(false);
    setIsPlannerLoaded(false);

    try {
      const loadedState = await loadPlannerState();

      remoteUpdatedAtRef.current = loadedState.updatedAt;

      if (loadedState.state) {
        setRuns(loadedState.state.runs);
        setTimelineEvents(
          loadedState.state.timelineEvents.map((event) => ({
            ...event,
            type: event.type as TimelineKind
          }))
        );
        setProductData(loadedState.state.productData);
        setMaterialStockKg(loadedState.state.materialStockKg);
        setManualProductInventory(loadedState.state.manualProductInventory);
      }

      skipNextSaveRef.current = true;
      setIsPlannerLoaded(true);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    hydratePlannerState();
  }, []);

  useEffect(() => {
    if (!isPlannerLoaded) {
      return;
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    const state: StoredPlannerState = {
      materialStockKg,
      manualProductInventory,
      productData,
      runs,
      timelineEvents
    };

    saveTimeoutRef.current = window.setTimeout(() => {
      savePlannerState(state, remoteUpdatedAtRef.current)
        .then((nextUpdatedAt) => {
          remoteUpdatedAtRef.current = nextUpdatedAt;
        })
        .catch(handleSaveError);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    isPlannerLoaded,
    materialStockKg,
    manualProductInventory,
    productData,
    runs,
    timelineEvents
  ]);

  function handleSaveError(error: unknown) {
    setNotice({
      title: "Save failed",
      body:
        error instanceof Error
          ? error.message
          : "Supabase could not save this change."
    });
  }

  function savePlannerSnapshot(nextRuns: PrintRun[]) {
    const state: StoredPlannerState = {
      materialStockKg,
      manualProductInventory,
      productData,
      runs: nextRuns,
      timelineEvents
    };

    savePlannerState(state, remoteUpdatedAtRef.current)
      .then((nextUpdatedAt) => {
        remoteUpdatedAtRef.current = nextUpdatedAt;
      })
      .catch(handleSaveError);
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const activeDrag = dragState;

    function handleWindowPointerUp(event: globalThis.PointerEvent) {
      const run = runs.find((entry) => entry.id === activeDrag.runId);

      if (run) {
        finishDragAt(event.clientX, event.clientY, run, event.pointerId);
      }
    }

    function handleWindowMouseUp(event: globalThis.MouseEvent) {
      const run = runs.find((entry) => entry.id === activeDrag.runId);

      if (run) {
        finishDragAt(event.clientX, event.clientY, run);
      }
    }

    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [dragState, runs, weekStart]);

  useEffect(() => {
    if (!savedInventoryProductId && !savedProductDataId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSavedInventoryProductId(null);
      setSavedProductDataId(null);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [savedInventoryProductId, savedProductDataId]);

  function updateNewPrint(field: keyof NewPrintForm, value: string) {
    setNewPrint((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateEditPrint(field: keyof NewPrintForm, value: string) {
    setEditPrint((current) =>
      current
        ? {
            ...current,
            [field]: value
          }
        : current
    );
  }

  function updateEditEvent(field: keyof NewEventForm, value: string) {
    setEditEvent((current) =>
      current
        ? {
            ...current,
            [field]: value
          }
        : current
    );
  }

  function addMaterialStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextKg = Number(materialAddKg);

    if (!Number.isFinite(nextKg) || nextKg <= 0) {
      return;
    }

    setMaterialStockKg((current) => Number((current + nextKg).toFixed(1)));
    setMaterialAddKg("");
    setIsMaterialAddOpen(false);
  }

  function openMaterialEdit() {
    setMaterialEditKg(String(materialStockKg));
    setIsMaterialEditOpen(true);
  }

  function saveMaterialStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextKg = Number(materialEditKg);

    if (!Number.isFinite(nextKg) || nextKg < 0) {
      return;
    }

    setMaterialStockKg(Number(nextKg.toFixed(1)));
    setIsMaterialEditOpen(false);
  }

  function updateProductStock(productId: Product["id"], value: string) {
    const nextValue = Math.max(Math.floor(Number(value) || 0), 0);

    setManualProductInventory((current) => ({
      ...current,
      [productId]: nextValue
    }));
  }

  function updateProductData(
    productId: Product["id"],
    field: "pelletUsageKg" | "printDurationHours",
    value: string
  ) {
    const nextValue = Math.max(Number(value) || 0, 0);

    setProductData((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              [field]: nextValue
            }
          : product
      )
    );
  }

  function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newProduct.name.trim().toLowerCase();
    const printDurationHours = Number(newProduct.printDurationHours);
    const pelletUsageKg = Number(newProduct.pelletUsageKg);

    if (!name || printDurationHours <= 0 || pelletUsageKg < 0) {
      return;
    }

    setProductData((current) => [
      ...current,
      {
        borderColor: newProduct.color,
        color: newProduct.color,
        id: getProductIdFromName(name, current),
        name,
        pelletUsageKg,
        printDurationHours
      }
    ]);
    setNewProduct({
      color: "#d3d0cb",
      name: "",
      pelletUsageKg: "",
      printDurationHours: ""
    });
    setIsNewProductOpen(false);
  }

  function toggleInventoryEdit(productId: Product["id"]) {
    setSavedInventoryProductId(null);

    if (editingInventoryProductId === productId) {
      setEditingInventoryProductId(null);
      setSavedInventoryProductId(productId);
      return;
    }

    setEditingInventoryProductId(productId);
  }

  function toggleProductDataEdit(productId: Product["id"]) {
    setSavedProductDataId(null);

    if (editingProductDataId === productId) {
      setEditingProductDataId(null);
      setSavedProductDataId(productId);
      return;
    }

    setEditingProductDataId(productId);
  }

  function openNewPrintForm() {
    const defaultStart = getDefaultNewPrintStart(weekStart, now);

    setNewPrint((current) => ({
      ...current,
      date: formatDateInput(defaultStart),
      status: "planned",
      time: formatTimeInput(defaultStart)
    }));
    setIsAddOpen(true);
  }

  function commitNewPrint(form: NewPrintForm, allowWeekend = false) {
    const run = buildCandidateRun(form, `custom-${Date.now()}`);
    const start = asDate(run.startDateTime);
    const printConflict = findPrintConflict(run, runs, productById);

    if (!form.project.trim()) {
      setNotice({
        title: "Project missing",
        body: "Add a project or customer first."
      });
      return;
    }

    if (start < now) {
      setNotice({
        title: "Past start blocked",
        body: "New prints cannot start in the past."
      });
      return;
    }

    if (printConflict) {
      setNotice({
        title: "Overlap blocked",
        body: `${printConflict.product.name} already uses this printer at that time.`
      });
      return;
    }

    if (isWeekend(start) && !allowWeekend) {
      setPendingWeekendAction({
        form,
        kind: "add"
      });
      return;
    }

    setRuns((current) => [...current, run]);
    setIsAddOpen(false);
    setNewPrint((current) => ({
      ...current,
      project: ""
    }));
  }

  function addNewPrint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitNewPrint(newPrint);
  }

  function openEditPanel(run: PrintRun) {
    setSelectedRunId(run.id);
    setEditPrint(buildEditForm(run));
  }

  function openEventEditPanel(entry: TimelineEntry) {
    const event = timelineEvents.find((timelineEvent) => timelineEvent.id === entry.id);

    if (!event) {
      return;
    }

    setIsEventOpen(false);
    setSelectedEventId(event.id);
    setEditEvent(buildEventForm(event));
  }

  function openTimelineEditPanel(entry: TimelineEntry) {
    if (entry.type === "deadline") {
      setIsEventOpen(false);
      setSelectedEventId(null);
      setEditEvent(null);
      setSelectedDeadline({
        originalDate: formatDateInput(entry.start),
        project: entry.deadlineProject ?? entry.title.replace(/^deadline\s+/i, "")
      });
      setEditDeadlineDate(formatDateInput(entry.start));
      return;
    }

    setSelectedDeadline(null);
    setEditDeadlineDate("");
    openEventEditPanel(entry);
  }

  function commitEditPrint(runId: string, form: NewPrintForm, allowWeekend = false) {
    const runToEdit = runs.find((run) => run.id === runId);

    if (!runToEdit || !form.project.trim()) {
      return;
    }

    const editRun = buildCandidateRun(form, runId);
    const start = asDate(editRun.startDateTime);
    const printConflict = findPrintConflict(editRun, runs, productById);

    if (start < now) {
      setNotice({
        title: "Past start blocked",
        body: "Prints cannot be moved into the past."
      });
      return;
    }

    if (printConflict) {
      setNotice({
        title: "Overlap blocked",
        body: `${printConflict.product.name} already uses this printer at that time.`
      });
      return;
    }

    if (isWeekend(start) && !allowWeekend) {
      setPendingWeekendAction({
        form,
        kind: "edit",
        runId
      });
      return;
    }

    const updatedRun = {
      ...runToEdit,
      ...editRun
    };

    setRuns((current) =>
      current.map((run) => (run.id === runId ? updatedRun : run))
    );
    setSelectedRunId(null);
    setEditPrint(null);
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRun || !editPrint || !canSaveEdit) {
      return;
    }

    commitEditPrint(selectedRun.id, editPrint);
  }

  function confirmWeekendStart() {
    const action = pendingWeekendAction;

    if (!action) {
      return;
    }

    setPendingWeekendAction(null);

    if (action.kind === "add" || action.kind === "drop-new-print") {
      commitNewPrint(action.form, true);
      return;
    }

    if (action.kind === "edit") {
      commitEditPrint(action.runId, action.form, true);
      return;
    }

    const run = runs.find((entry) => entry.id === action.runId);

    if (run) {
      moveRun(run, action.printerId, asDate(action.startDateTime), true);
    }
  }

  function addTimelineEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newEvent.title.trim()) {
      return;
    }

    setTimelineEvents((current) => [
      ...current,
      {
        color: newEvent.type === "custom" ? newEvent.customColor : undefined,
        endDateTime: buildStartDateTime(newEvent.endDate, "23:59"),
        id: `event-${Date.now()}`,
        startDateTime: buildStartDateTime(newEvent.startDate, "00:00"),
        tagLabel:
          newEvent.type === "custom" ? newEvent.customLabel.trim() || "custom" : undefined,
        title: newEvent.title.trim(),
        type: newEvent.type
      }
    ]);
    setNewEvent((current) => ({
      ...current,
      customLabel: "",
      title: ""
    }));
    setIsEventOpen(false);
  }

  function saveEventEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEvent || !editEvent || !editEvent.title.trim()) {
      return;
    }

    setTimelineEvents((current) =>
      current.map((timelineEvent) =>
        timelineEvent.id === selectedEvent.id
          ? {
              ...timelineEvent,
              color: editEvent.type === "custom" ? editEvent.customColor : undefined,
              endDateTime: buildStartDateTime(editEvent.endDate, "23:59"),
              startDateTime: buildStartDateTime(editEvent.startDate, "00:00"),
              tagLabel:
                editEvent.type === "custom"
                  ? editEvent.customLabel.trim() || "custom"
                  : undefined,
              title: editEvent.title.trim(),
              type: editEvent.type
            }
          : timelineEvent
      )
    );
    setSelectedEventId(null);
    setEditEvent(null);
  }

  function saveDeadlineEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDeadline || !editDeadlineDate) {
      return;
    }

    setRuns((current) =>
      current.map((run) =>
        run.project === selectedDeadline.project &&
        run.customerDeadline &&
        formatDateTimeInputDate(run.customerDeadline) === selectedDeadline.originalDate
          ? {
              ...run,
              customerDeadline: buildStartDateTime(editDeadlineDate, "18:00")
            }
          : run
      )
    );
    setSelectedDeadline(null);
    setEditDeadlineDate("");
  }

  function requestDeletePrint() {
    if (!selectedRun || !selectedProduct) {
      return;
    }

    setPendingDelete({
      kind: "print",
      label: `${selectedProduct.name} / ${selectedRun.project}`,
      runId: selectedRun.id
    });
  }

  function requestDeleteEvent() {
    if (!selectedEvent) {
      return;
    }

    setPendingDelete({
      eventId: selectedEvent.id,
      kind: "event",
      label: selectedEvent.title
    });
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return;
    }

    if (pendingDelete.kind === "print") {
      setRuns((current) => current.filter((run) => run.id !== pendingDelete.runId));
      setExpandedRunIds((current) => {
        const next = new Set(current);

        next.delete(pendingDelete.runId);
        return next;
      });

      if (selectedRunId === pendingDelete.runId) {
        setSelectedRunId(null);
        setEditPrint(null);
      }
    } else {
      setTimelineEvents((current) =>
        current.filter((event) => event.id !== pendingDelete.eventId)
      );

      if (selectedEventId === pendingDelete.eventId) {
        setSelectedEventId(null);
        setEditEvent(null);
      }
    }

    setPendingDelete(null);
  }

  function updateRunStatus(run: PrintRun, status: JobStatus, startDateTime?: string) {
    setRuns((current) =>
      current.map((entry) =>
        entry.id === run.id
          ? {
              ...entry,
              startDateTime: startDateTime ?? entry.startDateTime,
              status,
              progressPercent: status === "finished" ? 100 : undefined
            }
          : entry
      )
    );
  }

  function startPrint(run: PrintRun, useActualStart: boolean) {
    updateRunStatus(run, "printing", useActualStart ? formatDateTimeValue(now) : undefined);
    setPendingStartRunId(null);
  }

  function openReprintForm(run: PrintRun) {
    const nextWorkday = getNextWorkday(now);

    setNewPrint({
      assignee: run.assignee ?? "",
      customerDeadline: run.customerDeadline ? formatDateTimeInputDate(run.customerDeadline) : "",
      date: formatDateInput(nextWorkday),
      printerId: run.printerId,
      productId: run.productId,
      project: run.project,
      status: "reprint",
      time: "10:00"
    });
    setSelectedRunId(null);
    setEditPrint(null);
    setIsAddOpen(true);
  }

  function rescheduleRun(run: PrintRun) {
    updateRunStatus(run, "failed");
    openReprintForm(run);
    const product = productById.get(run.productId);

    setNotice({
      title: "Print failed",
      body: `${product?.name ?? "print"} is ready to reschedule as a reprint.`
    });
  }

  function getCardActions(run: PrintRun, actions: string[], isPast: boolean) {
    if (isPast) {
      return run.status === "failed" ? ["reschedule"] : [];
    }

    if (run.status === "planned" || run.status === "reprint") {
      return ["edit", ...actions];
    }

    if (run.status === "failed") {
      return ["reschedule"];
    }

    return actions;
  }

  function handleRunAction(event: MouseEvent<HTMLButtonElement>, run: PrintRun, action: string) {
    event.stopPropagation();

    if (action === "edit") {
      openEditPanel(run);
      return;
    }

    if (action === "reschedule") {
      openReprintForm(run);
      setNotice({
        title: "Reprint ready",
        body: "Adjust date, time, or printer, then add print."
      });
      return;
    }

    if (action === "print started") {
      const plannedStart = asDate(run.startDateTime);
      const startDiffMinutes = Math.abs(now.getTime() - plannedStart.getTime()) / (60 * 1000);

      if (startDiffMinutes >= 1) {
        setPendingStartRunId(run.id);
        return;
      }

      startPrint(run, false);
      return;
    }

    if (action === "print okay?") {
      updateRunStatus(run, "finished");
      return;
    }

    if (action === "print not okay?") {
      rescheduleRun(run);
    }
  }

  function canMoveRun(run: PrintRun) {
    const product = productById.get(run.productId);

    if (product && getEndDate(run, product) <= now) {
      return false;
    }

    return run.status === "planned" || run.status === "reprint";
  }

  function moveRun(run: PrintRun, printerId: PrinterId, start: Date, allowWeekend = false) {
    if (!canMoveRun(run)) {
      setNotice({
        title: "Move blocked",
        body: "Only planned prints can be moved."
      });
      return;
    }

    if (start < now) {
      setNotice({
        title: "Past start blocked",
        body: "Prints cannot be moved into the past."
      });
      return;
    }

    if (isWeekend(start) && !allowWeekend) {
      setPendingWeekendAction({
        kind: "move",
        printerId,
        runId: run.id,
        startDateTime: formatDateTimeValue(start)
      });
      return;
    }

    const movedRun = {
      ...run,
      printerId,
      startDateTime: formatDateTimeValue(start)
    };
    const conflictRun = findPrintConflict(movedRun, runs, productById);

    if (conflictRun) {
      setNotice({
        title: "Overlap blocked",
        body: `${conflictRun.product.name} already uses this printer at that time.`
      });
      return;
    }

    setRuns((current) => {
      const nextRuns = current.map((entry) => (entry.id === run.id ? movedRun : entry));

      savePlannerSnapshot(nextRuns);

      return nextRuns;
    });

    if (selectedRunId === run.id) {
      setEditPrint(buildEditForm(movedRun));
    }

    setNotice({
      title: "Print moved",
      body: `${productById.get(run.productId)?.name ?? "print"} starts ${formatCompactDate(
        start
      )} ${formatTime(start)}.`
    });
  }

  function handlePrintPointerDown(
    event: PointerEvent<HTMLElement>,
    run: PrintRun
  ) {
    if (!canMoveRun(run) || (event.target as HTMLElement).closest("button")) {
      return;
    }

    const cardRect = event.currentTarget.getBoundingClientRect();

    setDragState({
      deltaX: 0,
      deltaY: 0,
      grabOffsetX: event.clientX - cardRect.left,
      grabOffsetY: event.clientY - cardRect.top,
      runId: run.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateDragMovement(
    runId: string,
    clientX: number,
    clientY: number,
    pointerId?: number
  ) {
    setDragState((current) => {
      if (
        !current ||
        current.runId !== runId ||
        (pointerId !== undefined && current.pointerId !== pointerId)
      ) {
        return current;
      }

      const distance = Math.hypot(clientX - current.startX, clientY - current.startY);

      return {
        ...current,
        deltaX: clientX - current.startX,
        deltaY: clientY - current.startY,
        hasMoved: current.hasMoved || distance > 6
      };
    });
  }

  function finishDragAt(
    clientX: number,
    clientY: number,
    run: PrintRun,
    pointerId?: number
  ) {
    const currentDrag = dragState;

    if (
      !currentDrag ||
      currentDrag.runId !== run.id ||
      (pointerId !== undefined && currentDrag.pointerId !== pointerId)
    ) {
      return;
    }

    setDragState(null);
    nativeDragRef.current = null;

    const moved =
      currentDrag.hasMoved ||
      Math.hypot(clientX - currentDrag.startX, clientY - currentDrag.startY) > 6;

    if (!moved) {
      return false;
    }

    suppressClickRunId.current = run.id;

    const dropElement = document.elementFromPoint(clientX, clientY);
    const board =
      dropElement instanceof HTMLElement
        ? dropElement.closest<HTMLElement>("[data-printer-id]")
        : null;

    if (!board) {
      setNotice({
        title: "Move blocked",
        body: "Drop the print on a calendar slot."
      });
      return true;
    }

    const dropTarget = getDropStartFromBoard(
      board,
      clientX - currentDrag.grabOffsetX,
      clientY - currentDrag.grabOffsetY - 4,
      weekStart
    );

    if (!dropTarget) {
      setNotice({
        title: "Move blocked",
        body: "Drop the print on a printer calendar."
      });
      return true;
    }

    moveRun(run, dropTarget.printerId, dropTarget.start);
    return true;
  }

  function finishDragFromEvent(
    event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>,
    run: PrintRun,
    pointerId?: number
  ) {
    const wasHandled = finishDragAt(event.clientX, event.clientY, run, pointerId);

    if (wasHandled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handlePrintPointerMove(event: PointerEvent<HTMLElement>, run: PrintRun) {
    updateDragMovement(run.id, event.clientX, event.clientY, event.pointerId);
  }

  function handlePrintPointerUp(event: PointerEvent<HTMLElement>, run: PrintRun) {
    finishDragFromEvent(event, run, event.pointerId);
  }

  function handlePrintMouseMove(event: MouseEvent<HTMLElement>, run: PrintRun) {
    updateDragMovement(run.id, event.clientX, event.clientY);
  }

  function handlePrintMouseUp(event: MouseEvent<HTMLElement>, run: PrintRun) {
    finishDragFromEvent(event, run);
  }

  function handlePrintDragStart(event: DragEvent<HTMLElement>, run: PrintRun) {
    if (!canMoveRun(run) || (event.target as HTMLElement).closest("button")) {
      event.preventDefault();
      return;
    }

    const cardRect = event.currentTarget.getBoundingClientRect();

    nativeDragRef.current = {
      grabOffsetX: event.clientX - cardRect.left,
      grabOffsetY: event.clientY - cardRect.top,
      kind: "run",
      runId: run.id
    };

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `run:${run.id}`);
    setDragState({
      deltaX: 0,
      deltaY: 0,
      grabOffsetX: event.clientX - cardRect.left,
      grabOffsetY: event.clientY - cardRect.top,
      hasMoved: true,
      pointerId: -1,
      runId: run.id,
      startX: event.clientX,
      startY: event.clientY
    });
  }

  function handleNewPrintDragStart(event: DragEvent<HTMLElement>) {
    const cardRect = event.currentTarget.getBoundingClientRect();

    nativeDragRef.current = {
      grabOffsetX: event.clientX - cardRect.left,
      grabOffsetY: event.clientY - cardRect.top,
      kind: "new-print"
    };

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", "new-print");
  }

  function toggleCardDetails(event: MouseEvent<HTMLButtonElement>, runId: string) {
    event.stopPropagation();

    setExpandedRunIds((current) => {
      const next = new Set(current);

      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }

      return next;
    });
  }

  function handlePrintDragEnd() {
    nativeDragRef.current = null;
    setDragState(null);
  }

  function handleBoardDragOver(event: DragEvent<HTMLElement>) {
    if (!nativeDragRef.current) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleBoardDrop(event: DragEvent<HTMLElement>) {
    const dragMeta = nativeDragRef.current;

    if (!dragMeta) {
      return;
    }

    event.preventDefault();
    nativeDragRef.current = null;
    setDragState(null);

    const dropTarget = getDropStartFromBoard(
      event.currentTarget,
      event.clientX - dragMeta.grabOffsetX,
      event.clientY - dragMeta.grabOffsetY - 4,
      weekStart
    );

    if (!dropTarget) {
      setNotice({
        title: "Move blocked",
        body: "Drop the print on a printer calendar."
      });
      return;
    }

    if (dragMeta.kind === "new-print") {
      const droppedForm = {
        ...newPrint,
        date: formatDateInput(dropTarget.start),
        printerId: dropTarget.printerId,
        time: formatTimeInput(dropTarget.start)
      };

      if (dropTarget.start < now) {
        setNotice({
          title: "Past start blocked",
          body: "New prints cannot start in the past."
        });
        return;
      }

      if (isWeekend(dropTarget.start)) {
        setPendingWeekendAction({
          form: droppedForm,
          kind: "drop-new-print"
        });
        return;
      }

      commitNewPrint(droppedForm);
      return;
    }

    const run = runs.find((entry) => entry.id === dragMeta.runId);

    if (!run) {
      return;
    }

    suppressClickRunId.current = run.id;
    moveRun(run, dropTarget.printerId, dropTarget.start);
  }

  if (!isPlannerLoaded) {
    return (
      <main className="app-shell loading-shell">
        <header className="topbar">
          <img className="brand-logo" src="/logo/logo.png" alt="jelly" />
        </header>
        {loadError ? (
          <div className="load-error-panel">
            <p className="eyebrow">load failed</p>
            <button className="secondary-action" onClick={hydratePlannerState} type="button">
              retry
            </button>
          </div>
        ) : (
          <p className="eyebrow">loading planner</p>
        )}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <img className="brand-logo" src="/logo/logo.png" alt="jelly" />
        <button className="primary-action" onClick={openNewPrintForm} type="button">
          + print
        </button>
      </header>

      {isMaterialCritical && showInventoryPopup ? (
        <aside className="inventory-popup" aria-label="Material warning">
          <div>
            <strong>Material low</strong>
            <span>{reorderMessage}</span>
          </div>
          <button
            aria-label="Close material warning"
            className="icon-button popup-close"
            onClick={() => setShowInventoryPopup(false)}
            type="button"
          />
        </aside>
      ) : null}

      {notice ? (
        <aside className="notice-popup" aria-label="Notice">
          <div>
            <strong>{notice.title}</strong>
            <span>{notice.body}</span>
          </div>
          <button
            aria-label="Close notice"
            className="icon-button popup-close"
            onClick={() => setNotice(null)}
            type="button"
          />
        </aside>
      ) : null}

      {pendingStartRun ? (
        <aside className="start-popup" aria-label="Confirm actual start time">
          <div>
            <strong>Different start time?</strong>
            <span>
              Print started at {formatTime(now)} instead of{" "}
              {formatTime(asDate(pendingStartRun.startDateTime))}?
            </span>
          </div>
          <button onClick={() => startPrint(pendingStartRun, true)} type="button">
            Yes
          </button>
          <button
            className="ghost-action"
            onClick={() => startPrint(pendingStartRun, false)}
            type="button"
          >
            No
          </button>
        </aside>
      ) : null}

      {pendingWeekendAction ? (
        <aside className="start-popup weekend-popup" aria-label="Confirm weekend start">
          <div>
            <strong>Weekend start?</strong>
            <span>
              Start on {formatDayHeading(getPendingWeekendStart(pendingWeekendAction))}?
            </span>
          </div>
          <button onClick={confirmWeekendStart} type="button">
            Yes
          </button>
          <button
            className="ghost-action"
            onClick={() => setPendingWeekendAction(null)}
            type="button"
          >
            No
          </button>
        </aside>
      ) : null}

      {pendingDelete ? (
        <aside className="delete-popup" aria-label="Confirm delete">
          <div>
            <strong>really delete?</strong>
            <span>{pendingDelete.label}</span>
          </div>
          <button onClick={confirmDelete} type="button">
            Delete
          </button>
          <button
            aria-label="Cancel delete"
            className="icon-button popup-close"
            onClick={() => setPendingDelete(null)}
            type="button"
          />
        </aside>
      ) : null}

      {isAddOpen ? (
        <section className="add-print-panel print-composer" aria-label="Add print">
          <div className="panel-heading composer-heading">
            <button
              aria-label="Close new print form"
              className="icon-button"
              onClick={() => setIsAddOpen(false)}
              type="button"
            />
          </div>

          <form className="print-form print-composer-form" onSubmit={addNewPrint}>
            <article
              className="new-print-preview"
              draggable
              onDragStart={handleNewPrintDragStart}
              style={getPreviewStyle(selectedNewProduct)}
              title="Drag into calendar"
            >
              <div className="card-topline">
                <div className="card-status-pills">
                  {newPrint.status !== "planned" ? <span>{newPrint.status}</span> : null}
                  {newPrint.assignee ? (
                    <span className="assignee-pill">
                      {starterById.get(newPrint.assignee)?.initial}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="card-body">
                <strong>{selectedNewProduct.name}</strong>
                <span>{newPrint.project.trim() || "project or customer"}</span>
              </div>
              <div className="card-times">
                <span>
                  {getTimeRangeLabel({
                    end: candidateEnd,
                    product: selectedNewProduct,
                    run: candidateRun,
                    start: candidateStart
                  })}
                </span>
                {newPrint.customerDeadline ? (
                  <span>deadline {formatCompactDate(asDate(newPrint.customerDeadline))}</span>
                ) : null}
              </div>
            </article>

            <label>
              <span>product</span>
              <select
                value={newPrint.productId}
                onChange={(event) => updateNewPrint("productId", event.target.value)}
              >
                {visibleProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>project</span>
              <input
                placeholder="project or customer"
                value={newPrint.project}
                onChange={(event) => updateNewPrint("project", event.target.value)}
              />
            </label>

            <label>
              <span>printer</span>
              <select
                value={newPrint.printerId}
                onChange={(event) => updateNewPrint("printerId", event.target.value)}
              >
                {printers.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {formatPrinterName(printer)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>starter</span>
              <select
                value={newPrint.assignee}
                onChange={(event) => updateNewPrint("assignee", event.target.value)}
              >
                <option value="">not set</option>
                {printStarters.map((starter) => (
                  <option key={starter.id} value={starter.id}>
                    {starter.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>start date</span>
              <input
                type="date"
                value={newPrint.date}
                onChange={(event) => updateNewPrint("date", event.target.value)}
              />
            </label>

            <label>
              <span>start time</span>
              <input
                type="time"
                value={newPrint.time}
                onChange={(event) => updateNewPrint("time", event.target.value)}
              />
            </label>

            <label>
              <span>deadline</span>
              <input
                type="date"
                value={newPrint.customerDeadline}
                onChange={(event) => updateNewPrint("customerDeadline", event.target.value)}
              />
            </label>

            <button disabled={!canAddPrint} type="submit">
              Add print
            </button>
          </form>

          {newPrint.status === "reprint" ? (
            <p className="form-alert">Reprint ready. Adjust date, time, or printer.</p>
          ) : null}
          {hasPastStart ? <p className="form-alert">start cannot be in the past</p> : null}
          {conflict ? (
            <p className="form-alert">
              conflict with {conflict.product.name} / {conflict.run.project},{" "}
              {formatCompactDate(conflict.start)} {formatTime(conflict.start)}-
              {formatTime(conflict.end)}
            </p>
          ) : null}
          {hasWeekendStart ? (
            <p className="form-alert">Weekend start needs confirmation</p>
          ) : null}
        </section>
      ) : null}

      {selectedRun && editPrint && selectedProduct && editProduct && editStart && editEnd ? (
        <section className="add-print-panel edit-print-panel" aria-label="Edit print">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Edit print</p>
              <h2>{selectedProduct.name}</h2>
            </div>
            <button
              aria-label="Close edit print form"
              className="icon-button"
              onClick={() => {
                setSelectedRunId(null);
                setEditPrint(null);
              }}
              type="button"
            />
          </div>

          <form className="print-form" onSubmit={saveEdit}>
            <label>
              <span>product</span>
              <select
                value={editPrint.productId}
                onChange={(event) => updateEditPrint("productId", event.target.value)}
              >
                {visibleProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>project</span>
              <input
                value={editPrint.project}
                onChange={(event) => updateEditPrint("project", event.target.value)}
              />
            </label>

            <label>
              <span>printer</span>
              <select
                value={editPrint.printerId}
                onChange={(event) => updateEditPrint("printerId", event.target.value)}
              >
                {printers.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {formatPrinterName(printer)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>starter</span>
              <select
                value={editPrint.assignee}
                onChange={(event) => updateEditPrint("assignee", event.target.value)}
              >
                <option value="">not set</option>
                {printStarters.map((starter) => (
                  <option key={starter.id} value={starter.id}>
                    {starter.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>start date</span>
              <input
                type="date"
                value={editPrint.date}
                onChange={(event) => updateEditPrint("date", event.target.value)}
              />
            </label>

            <label>
              <span>start time</span>
              <input
                type="time"
                value={editPrint.time}
                onChange={(event) => updateEditPrint("time", event.target.value)}
              />
            </label>

            <label>
              <span>deadline</span>
              <input
                type="date"
                value={editPrint.customerDeadline}
                onChange={(event) => updateEditPrint("customerDeadline", event.target.value)}
              />
            </label>

            <button disabled={!canSaveEdit} type="submit">
              Save
            </button>
            <button className="danger-action" onClick={requestDeletePrint} type="button">
              Delete
            </button>
          </form>

          {editConflict ? (
            <p className="form-alert">
              Conflict with {editConflict.product.name} / {editConflict.run.project},{" "}
              {formatCompactDate(editConflict.start)} {formatTime(editConflict.start)}-
              {formatTime(editConflict.end)}
            </p>
          ) : null}
          {editWeekendStart ? (
            <p className="form-alert">Weekend start needs confirmation</p>
          ) : null}
        </section>
      ) : null}

      <section className="calendar-shell" aria-label="Production calendar">
        <div className="calendar-week-header" aria-label="Week navigation">
          <div className="calendar-time-spacer" />
          <div className="week-days-wrap">
            {canGoBack ? (
              <button
                aria-label="Previous week"
                className="week-arrow is-left"
                onClick={() =>
                  setWeekOffset((current) => Math.max(current - 1, MIN_WEEK_OFFSET))
                }
                type="button"
              >
              </button>
            ) : null}
            <div className="week-day-row" aria-hidden="true">
              {weekDays.map((day) => (
                <div
                  className={`day-heading ${isWeekend(day.date) ? "is-weekend" : ""}`}
                  key={day.date.toISOString()}
                >
                  <strong>
                    <span className="day-label-full">{day.label}</span>
                    <span className="day-label-short">{day.shortLabel}</span>
                  </strong>
                </div>
              ))}
            </div>
            {canGoForward ? (
              <button
                aria-label="Next week"
                className={`week-arrow is-right ${!canGoBack ? "is-single" : ""}`}
                onClick={() =>
                  setWeekOffset((current) => Math.min(current + 1, MAX_WEEK_OFFSET))
                }
                type="button"
              >
              </button>
            ) : null}
          </div>
        </div>

        <section className="mobile-agenda" aria-label="Mobile printer schedule">
          {weekDays.map((day, dayIndex) => {
            const dayEnd = addDays(day.date, 1);
            const dayEvents = timelineEntries.filter(
              (entry) => entry.start < dayEnd && entry.end >= day.date
            );

            return (
            <section className="mobile-day" key={day.date.toISOString()}>
              <h2>{day.label}</h2>
              {dayEvents.length > 0 ? (
                <div className="mobile-event-list">
                  {dayEvents.map((entry) => {
                    const isEditable =
                      entry.type === "deadline" ||
                      timelineEvents.some((event) => event.id === entry.id);
                    const isPastEvent = entry.end < now;

                    return (
                      <article
                        aria-disabled={!isEditable}
                        className={`mobile-event-item ${getTimelineTypeClass(entry.type)} ${
                          isPastEvent ? "is-past" : ""
                        }`}
                        key={`${entry.id}-${day.date.toISOString()}`}
                        style={
                          { "--event-color": getTimelineColor(entry) } as CSSProperties
                        }
                      >
                        {getTimelineLabel(entry)}
                        {isEditable ? (
                          <button
                            className="mini-edit-pill timeline-edit-button"
                            onClick={() => openTimelineEditPanel(entry)}
                            type="button"
                          >
                            edit
                          </button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : null}
              <div className="mobile-printer-list">
                {printers.map((printer) => {
                  const segments = layoutRuns(runs, printer.id, weekStart, productById).segments
                    .filter((segment) => segment.dayIndex === dayIndex)
                    .sort(
                      (a, b) =>
                        a.segmentStart.getTime() - b.segmentStart.getTime() ||
                        a.lane - b.lane
                    );

                  return (
                    <section className="mobile-printer-block" key={printer.id}>
                      <p className="eyebrow">{formatPrinterName(printer)}</p>
                      {segments.length === 0 ? (
                        <p className="mobile-empty">free</p>
                      ) : (
                        segments.map((segment) => {
                          const progress = getProgress(segment, now);
                          const isPast = segment.end <= now;
                          const starter = segment.run.assignee
                            ? starterById.get(segment.run.assignee)
                            : null;

                          const segmentLabel = getSegmentLabel(segment, now);
                          const canEditMobile =
                            !isPast &&
                            (segment.run.status === "planned" ||
                              segment.run.status === "reprint");

                          return (
                            <article
                              className={`mobile-print-card status-${segment.run.status} ${
                                isPast ? "is-past" : ""
                              }`}
                              key={`${segment.run.id}-${segment.dayIndex}`}
                              style={getProductStyle(segment.product)}
                            >
                              <span className="mobile-card-topline">
                                <strong>{segment.product.name}</strong>
                                <span className="mobile-card-topline-actions">
                                  {starter ? (
                                    <span className="assignee-pill">{starter.initial}</span>
                                  ) : null}
                                  {canEditMobile ? (
                                    <button
                                      className="mobile-edit-button"
                                      onClick={() => openEditPanel(segment.run)}
                                      type="button"
                                    >
                                      edit
                                    </button>
                                  ) : null}
                                </span>
                              </span>
                              <span>{getProjectLabel(segment.run)}</span>
                              <span>{getTimeRangeLabel(segment)}</span>
                              {shouldShowStatusPill(segmentLabel) || progress !== null ? (
                                <span className="mobile-card-status">
                                  {shouldShowStatusPill(segmentLabel) ? segmentLabel : ""}
                                  {progress !== null ? ` ${progress}%` : ""}
                                </span>
                              ) : null}
                            </article>
                          );
                        })
                      )}
                    </section>
                  );
                })}
              </div>
            </section>
            );
          })}
        </section>

        <section className="printer-calendars" aria-label="Printer schedule">
        {printers.map((printer) => {
          const layout = layoutRuns(runs, printer.id, weekStart, productById);

          return (
            <section className="printer-calendar" key={printer.id}>
              <div className="printer-title">
                <h2>{printer.name}</h2>
              </div>

              <div className="time-gutter" aria-hidden="true">
                {HOURS.map((hour) => (
                  <span
                    className="time-label"
                    key={hour}
                    style={{ "--hour": hour } as CSSProperties}
                  >
                    {formatHourLabel(hour)}
                  </span>
                ))}
              </div>

              <div className="calendar-frame">
                  <div
                    className="time-board"
                    data-printer-id={printer.id}
                    onDragOver={handleBoardDragOver}
                    onDrop={handleBoardDrop}
                  >
                    <div className="day-columns" aria-hidden="true">
                      {weekDays.map((day) => (
                        <div
                          className={`time-day ${isWeekend(day.date) ? "is-weekend" : ""}`}
                          key={day.date.toISOString()}
                        />
                      ))}
                    </div>

                    <div className="hour-lines" aria-hidden="true">
                      {HOUR_LINES.map((hour) => (
                        <span
                          className="hour-line"
                          key={hour}
                          style={{ "--hour": hour } as CSSProperties}
                        />
                      ))}
                    </div>

                    <div className="print-layer">
                      {currentTimeStyle ? (
                        <div
                          className="current-time-marker"
                          style={currentTimeStyle}
                          aria-label={`Current time ${formatTime(now)}`}
                        />
                      ) : null}

                      {layout.segments.length === 0 ? (
                        <p className="empty-week">no prints this week</p>
                      ) : null}

                      {layout.segments.map((segment) => {
                        const cardDeadline = getCardDeadlineDate(
                          segment.run,
                          segment.product
                        );
                        const progress = getProgress(segment, now);
                        const actions = getRunActionLabels(segment, now);
                        const isPast = segment.end <= now;
                        const cardActions = getCardActions(segment.run, actions, isPast);
                        const hasEditAction =
                          !segment.startsBeforeSegment && cardActions.includes("edit");
                        const lowerCardActions = segment.continuesAfterSegment
                          ? []
                          : cardActions.filter((action) => action !== "edit");
                        const isShort = segment.durationHours <= 5;
                        const isExpanded = expandedRunIds.has(segment.run.id);
                        const showCompactProject =
                          isShort && !isExpanded && canShowCompactProject(segment);
                        const segmentLabel = getSegmentLabel(segment, now);
                        const showStatusPill = shouldShowStatusPill(segmentLabel);
                        const statusInActions =
                          showStatusPill &&
                          (segmentLabel === "done" || segmentLabel === "failed");
                        const starter = segment.run.assignee
                          ? starterById.get(segment.run.assignee)
                          : null;
                        const activeDrag =
                          dragState?.runId === segment.run.id ? dragState : null;
                        const cardStyle: SegmentStyle = {
                          ...getSegmentStyle(segment),
                          "--drag-x": `${activeDrag?.deltaX ?? 0}px`,
                          "--drag-y": `${activeDrag?.deltaY ?? 0}px`
                        };

                        return (
                          <article
                            className={`print-card status-${segment.run.status} ${
                              segment.run.priority === "urgent" ? "is-urgent" : ""
                            } ${segment.startsBeforeSegment ? "is-continuation" : ""} ${
                              segment.continuesAfterSegment ? "continues-after" : ""
                            } ${isShort ? "is-short" : ""} ${
                              isExpanded ? "is-expanded" : ""
                            } ${isPast ? "is-past" : ""} ${
                              canMoveRun(segment.run) ? "is-movable" : ""
                            } ${
                              activeDrag ? "is-dragging" : ""
                            }`}
                            draggable={canMoveRun(segment.run)}
                            key={`${segment.run.id}-${segment.dayIndex}`}
                            onDragEnd={handlePrintDragEnd}
                            onDragStart={(event) =>
                              handlePrintDragStart(event, segment.run)
                            }
                            onMouseMove={(event) => handlePrintMouseMove(event, segment.run)}
                            onMouseUp={(event) => handlePrintMouseUp(event, segment.run)}
                            onPointerCancel={() => setDragState(null)}
                            onPointerDown={(event) =>
                              handlePrintPointerDown(event, segment.run)
                            }
                            onPointerMove={(event) =>
                              handlePrintPointerMove(event, segment.run)
                            }
                            onPointerUp={(event) => handlePrintPointerUp(event, segment.run)}
                            style={cardStyle}
                            tabIndex={0}
                            title={buildRunTitle(segment)}
                          >
                            <div className="card-topline">
                              <div className="card-status-pills">
                                {showStatusPill && !statusInActions ? (
                                  <span>{segmentLabel}</span>
                                ) : null}
                                {starter ? (
                                  <span className="assignee-pill">{starter.initial}</span>
                                ) : null}
                              </div>
                              <div className="card-topline-actions">
                                {progress !== null ? <strong>{progress}%</strong> : null}
                                {statusInActions ? <span>{segmentLabel}</span> : null}
                                {hasEditAction ? (
                                  <button
                                    className="card-pill-button"
                                    onClick={(event) =>
                                      handleRunAction(event, segment.run, "edit")
                                    }
                                    onPointerDown={(event) => event.stopPropagation()}
                                    type="button"
                                  >
                                    edit
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {progress !== null ? (
                              <div className="progress-track" aria-label={`${progress}% printed`}>
                                <span style={{ width: `${progress}%` }} />
                              </div>
                            ) : null}

                            <div className="card-body">
                              <div className="card-product-line">
                                <strong>{segment.product.name}</strong>
                                {isShort ? (
                                  <button
                                    aria-expanded={isExpanded}
                                    aria-label={
                                      isExpanded ? "Hide print details" : "Show print details"
                                    }
                                    className={`show-more-button ${
                                      isExpanded ? "is-open" : ""
                                    }`}
                                    onClick={(event) =>
                                      toggleCardDetails(event, segment.run.id)
                                    }
                                    onPointerDown={(event) => event.stopPropagation()}
                                    type="button"
                                  >
                                  </button>
                                ) : null}
                              </div>
                              <span>{getProjectLabel(segment.run)}</span>
                              {showCompactProject ? (
                                <span className="compact-project-label">
                                  {getCompactProjectLabel(segment.run)}
                                </span>
                              ) : null}
                            </div>

                            <div className="card-times">
                              <span>{getTimeRangeLabel(segment)}</span>
                              {cardDeadline ? (
                                <span>deadline {formatCompactDate(cardDeadline)}</span>
                              ) : null}
                            </div>

                            {lowerCardActions.length > 0 ? (
                              <div className="card-actions">
                                {lowerCardActions.map((action) => (
                                  <button
                                    key={action}
                                    onClick={(event) =>
                                      handleRunAction(event, segment.run, action)
                                    }
                                    onPointerDown={(event) => event.stopPropagation()}
                                    type="button"
                                  >
                                    {action}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>
              </div>
            </section>
          );
        })}
        </section>

        <section className="event-timeline" aria-label="Marketing and deadline timeline">
          <div className="timeline-title">
            <p className="eyebrow">Events</p>
            <button
              className="primary-action"
              onClick={() => {
                setSelectedEventId(null);
                setEditEvent(null);
                setSelectedDeadline(null);
                setEditDeadlineDate("");
                setIsEventOpen((current) => !current);
              }}
              type="button"
            >
              + create event
            </button>
          </div>

          {selectedEvent && editEvent ? (
            <form
              className="event-form event-edit-inline"
              aria-label="Edit event"
              onSubmit={saveEventEdit}
            >
              <label>
                <span>title</span>
                <input
                  value={editEvent.title}
                  onChange={(event) => updateEditEvent("title", event.target.value)}
                />
              </label>
              <label>
                <span>tag</span>
                <select
                  value={editEvent.type}
                  onChange={(event) =>
                    updateEditEvent("type", event.target.value as TimelineKind)
                  }
                >
                  <option value="social media">social media</option>
                  <option value="event">event</option>
                  <option value="deadline">deadline</option>
                  <option value="ooo">ooo</option>
                  <option value="custom">custom</option>
                </select>
              </label>
              {editEvent.type === "custom" ? (
                <>
                  <label>
                    <span>custom tag</span>
                    <input
                      placeholder="tag"
                      value={editEvent.customLabel}
                      onChange={(event) => updateEditEvent("customLabel", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>color</span>
                    <input
                      type="color"
                      value={editEvent.customColor}
                      onChange={(event) => updateEditEvent("customColor", event.target.value)}
                    />
                  </label>
                </>
              ) : null}
              <label>
                <span>start</span>
                <input
                  type="date"
                  value={editEvent.startDate}
                  onChange={(event) => updateEditEvent("startDate", event.target.value)}
                />
              </label>
              <label>
                <span>end</span>
                <input
                  type="date"
                  value={editEvent.endDate}
                  onChange={(event) => updateEditEvent("endDate", event.target.value)}
                />
              </label>
              <button disabled={!canSaveEventEdit} type="submit">
                Save
              </button>
              <button className="danger-action" onClick={requestDeleteEvent} type="button">
                Delete
              </button>
              <button
                aria-label="Close event edit"
                className="icon-button"
                onClick={() => {
                  setSelectedEventId(null);
                  setEditEvent(null);
                }}
                type="button"
              />
            </form>
          ) : null}

          {selectedDeadline ? (
            <form
              className="event-form event-edit-inline deadline-edit-inline"
              aria-label="Edit deadline"
              onSubmit={saveDeadlineEdit}
            >
              <label>
                <span>deadline</span>
                <input value={selectedDeadline.project} readOnly />
              </label>
              <label>
                <span>date</span>
                <input
                  type="date"
                  value={editDeadlineDate}
                  onChange={(event) => setEditDeadlineDate(event.target.value)}
                />
              </label>
              <button disabled={!canSaveDeadlineEdit} type="submit">
                Save
              </button>
              <button
                aria-label="Close deadline edit"
                className="icon-button"
                onClick={() => {
                  setSelectedDeadline(null);
                  setEditDeadlineDate("");
                }}
                type="button"
              />
            </form>
          ) : null}

          {isEventOpen ? (
            <form className="event-form" onSubmit={addTimelineEvent}>
              <label>
                <span>title</span>
                <input
                  placeholder="event"
                  value={newEvent.title}
                  onChange={(event) =>
                    setNewEvent((current) => ({
                      ...current,
                      title: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>tag</span>
                <select
                  value={newEvent.type}
                  onChange={(event) =>
                    setNewEvent((current) => ({
                      ...current,
                      type: event.target.value as TimelineKind
                    }))
                  }
                >
                  <option value="social media">social media</option>
                  <option value="event">event</option>
                  <option value="deadline">deadline</option>
                  <option value="ooo">ooo</option>
                  <option value="custom">custom</option>
                </select>
              </label>
              {newEvent.type === "custom" ? (
                <>
                  <label>
                    <span>custom tag</span>
                    <input
                      placeholder="tag"
                      value={newEvent.customLabel}
                      onChange={(event) =>
                        setNewEvent((current) => ({
                          ...current,
                          customLabel: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>color</span>
                    <input
                      type="color"
                      value={newEvent.customColor}
                      onChange={(event) =>
                        setNewEvent((current) => ({
                          ...current,
                          customColor: event.target.value
                        }))
                      }
                    />
                  </label>
                </>
              ) : null}
              <label>
                <span>start</span>
                <input
                  type="date"
                  value={newEvent.startDate}
                  onChange={(event) =>
                    setNewEvent((current) => ({
                      ...current,
                      startDate: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>end</span>
                <input
                  type="date"
                  value={newEvent.endDate}
                  onChange={(event) =>
                    setNewEvent((current) => ({
                      ...current,
                      endDate: event.target.value
                    }))
                  }
                />
              </label>
              <button disabled={!newEvent.title.trim()} type="submit">
                Create
              </button>
              <button
                aria-label="Cancel event"
                className="icon-button"
                onClick={() => setIsEventOpen(false)}
                type="button"
              />
            </form>
          ) : null}

          <div className="timeline-row">
            <div className="calendar-time-spacer" />
            <div className="timeline-board">
              {timelineEntries.length === 0 ? (
                <p className="empty-timeline">no events this week</p>
              ) : null}
              {timelineEntries.map((entry, index) => {
                const isEditable =
                  entry.type === "deadline" ||
                  timelineEvents.some((event) => event.id === entry.id);

                const isPastEvent = entry.end < now;

                return (
                  <article
                    aria-disabled={!isEditable}
                    className={`timeline-item ${getTimelineTypeClass(entry.type)} ${
                      isPastEvent ? "is-past" : ""
                    } ${isEditable ? "is-editable" : ""}`}
                    key={entry.id}
                    style={getTimelineStyle(entry, weekStart, index)}
                    title={`${entry.title} / ${entry.tagLabel ?? entry.type} / ${formatCompactDate(
                      entry.start
                    )}`}
                  >
                    {getTimelineLabel(entry)}
                    {isEditable ? (
                      <button
                        className="mini-edit-pill timeline-edit-button"
                        onClick={() => openTimelineEditPanel(entry)}
                        type="button"
                      >
                        edit
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </section>

      <section className="inventory-summary" aria-label="Material inventory">
        <div className="material-heading">
          <div>
            <p className="eyebrow">Material inventory</p>
            {isMaterialEditOpen ? (
              <form className="material-stock-edit" onSubmit={saveMaterialStock}>
                <label className="inventory-input">
                  <span>kg pellets</span>
                  <input
                    autoFocus
                    min="0"
                    step="0.5"
                    type="number"
                    value={materialEditKg}
                    onChange={(event) => setMaterialEditKg(event.target.value)}
                  />
                </label>
                <button disabled={!materialEditKg} type="submit">
                  save
                </button>
                <button
                  aria-label="Cancel material edit"
                  className="icon-button"
                  onClick={() => setIsMaterialEditOpen(false)}
                  type="button"
                />
              </form>
            ) : (
              <div className="material-stock-line">
                <h2>{materialStockKg} kg pellets</h2>
                <button className="mini-edit-pill" onClick={openMaterialEdit} type="button">
                  edit
                </button>
              </div>
            )}
          </div>
          <div className="material-add">
            {isMaterialAddOpen ? (
              <form className="material-add-form" onSubmit={addMaterialStock}>
                <label className="inventory-input">
                  <span>kg</span>
                  <input
                    autoFocus
                    min="0"
                    step="0.5"
                    type="number"
                    value={materialAddKg}
                    onChange={(event) => setMaterialAddKg(event.target.value)}
                  />
                </label>
                <button disabled={!Number(materialAddKg)} type="submit">
                  Add
                </button>
                <button
                  aria-label="Cancel material input"
                  className="icon-button"
                  onClick={() => {
                    setIsMaterialAddOpen(false);
                    setMaterialAddKg("");
                  }}
                  type="button"
                />
              </form>
            ) : (
              <button
                className="secondary-action"
                onClick={() => setIsMaterialAddOpen(true)}
                type="button"
              >
                + add new material
              </button>
            )}
          </div>
        </div>
        <div className="inventory-metrics">
          <span>planned next 2 weeks {plannedPelletUsageKg.toFixed(1)} kg</span>
          <span>projected next 2 weeks {projectedStockKg.toFixed(1)} kg</span>
          <span>{reorderMessage}</span>
        </div>
      </section>

      <section className="product-inventory" aria-label="Product inventory">
        <div className="section-heading">
          <p className="eyebrow">Product inventory</p>
          <h2>
            {inventoryRows.reduce((sum, product) => sum + product.stockCount, 0)} in stock
          </h2>
        </div>
        <div className="stock-list">
          {inventoryRows.map((product) => (
            <article className="stock-row" key={product.id} style={getProductStyle(product)}>
              <button
                className="mini-edit-pill stock-edit-button"
                onClick={() => toggleInventoryEdit(product.id)}
                type="button"
              >
                {editingInventoryProductId === product.id
                  ? "save"
                  : savedInventoryProductId === product.id
                    ? "saved"
                    : "edit"}
              </button>
              <strong>
                <span aria-hidden="true" />
                {product.name}
              </strong>
              <em>{product.stockCount}</em>
              {editingInventoryProductId === product.id ? (
                <label>
                  <input
                    min="0"
                    type="number"
                    value={product.baseStockCount}
                    onChange={(event) => updateProductStock(product.id, event.target.value)}
                  />
                </label>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <details className="data-drawer">
        <summary>
          <span>Product data</span>
          <button
            className="mini-edit-pill product-add-button"
            onClick={(event) => {
              event.preventDefault();
              setIsNewProductOpen((current) => !current);
            }}
            type="button"
          >
            + product
          </button>
        </summary>
        <div className="drawer-grid">
          {isNewProductOpen ? (
            <form className="product-create-form" onSubmit={addProduct}>
              <label>
                <span>product</span>
                <input
                  autoFocus
                  value={newProduct.name}
                  onChange={(event) =>
                    setNewProduct((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>printing time</span>
                <input
                  min="0"
                  step="0.5"
                  type="number"
                  value={newProduct.printDurationHours}
                  onChange={(event) =>
                    setNewProduct((current) => ({
                      ...current,
                      printDurationHours: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>weight</span>
                <input
                  min="0"
                  step="0.5"
                  type="number"
                  value={newProduct.pelletUsageKg}
                  onChange={(event) =>
                    setNewProduct((current) => ({
                      ...current,
                      pelletUsageKg: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>color</span>
                <input
                  type="color"
                  value={newProduct.color}
                  onChange={(event) =>
                    setNewProduct((current) => ({
                      ...current,
                      color: event.target.value
                    }))
                  }
                />
              </label>
              <button
                disabled={
                  !newProduct.name.trim() ||
                  Number(newProduct.printDurationHours) <= 0 ||
                  Number(newProduct.pelletUsageKg) < 0
                }
                type="submit"
              >
                save
              </button>
              <button
                aria-label="Cancel new product"
                className="icon-button"
                onClick={() => setIsNewProductOpen(false)}
                type="button"
              />
            </form>
          ) : null}
          <div className="product-list">
            {visibleProducts.map((product) => (
              <article className="product-row" key={product.id} style={getProductStyle(product)}>
                <button
                  className="mini-edit-pill product-edit-button"
                  onClick={() => toggleProductDataEdit(product.id)}
                  type="button"
                >
                  {editingProductDataId === product.id
                    ? "save"
                    : savedProductDataId === product.id
                      ? "saved"
                      : "edit"}
                </button>
                <strong>
                  <span aria-hidden="true" />
                  {product.name}
                </strong>
                {editingProductDataId === product.id ? (
                  <div className="product-data-edit">
                    <label>
                      <span>printing time</span>
                      <input
                        min="0"
                        step="0.5"
                        type="number"
                        value={product.printDurationHours}
                        onChange={(event) =>
                          updateProductData(product.id, "printDurationHours", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>weight</span>
                      <input
                        min="0"
                        step="0.5"
                        type="number"
                        value={product.pelletUsageKg}
                        onChange={(event) =>
                          updateProductData(product.id, "pelletUsageKg", event.target.value)
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    <span>
                      Printing time: {formatHours(product.printDurationHours)}
                      {product.isEstimated ? " estimated" : ""}
                    </span>
                    <span>Weight: {product.pelletUsageKg.toFixed(1)}kg</span>
                  </>
                )}
              </article>
            ))}
          </div>
        </div>
      </details>
    </main>
  );
}
