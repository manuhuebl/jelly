export type PrinterId = "printer-1" | "printer-2";

export type JobStatus = "planned" | "printing" | "finished" | "failed" | "reprint";

export type Priority = "normal" | "urgent";

export type PrintAssignee = "manu" | "julian" | "saqib";

export type ShippingBoxType = "42x42x33" | "50x50x50" | "60x60x39" | "60x60x60";

export type Product = {
  id: string;
  name: string;
  printDurationHours: number;
  pelletUsageKg: number;
  color: string;
  borderColor: string;
  shippingBoxType: string;
  isEstimated?: boolean;
};

export type PrintRun = {
  id: string;
  productId: Product["id"];
  project: string;
  printerId: PrinterId;
  startDateTime: string;
  status: JobStatus;
  priority: Priority;
  customerDeadline?: string;
  assignee?: PrintAssignee;
  note?: string;
  progressPercent?: number;
  sequence?: string;
  skipDeadlineBuffer?: boolean;
  reprintOf?: string;
};

export type StudioTask = {
  id: string;
  title: string;
  subtitle: string;
  dueDateTime: string;
};

export const printers: Array<{ id: PrinterId; name: string; side: string }> = [
  { id: "printer-1", name: "1", side: "left" },
  { id: "printer-2", name: "2", side: "right" }
];

export const shippingBoxTypes: ShippingBoxType[] = [
  "60x60x60",
  "50x50x50",
  "60x60x39",
  "42x42x33"
];

export const shippingBoxInventory: Record<ShippingBoxType, number> = {
  "60x60x60": 0,
  "50x50x50": 0,
  "60x60x39": 0,
  "42x42x33": 0
};

export const products: Product[] = [
  {
    id: "bench-center",
    name: "bench module center",
    printDurationHours: 24,
    pelletUsageKg: 15,
    color: "#d8ccb5",
    borderColor: "#d8ccb5",
    shippingBoxType: "60x60x60"
  },
  {
    id: "bench-end-right",
    name: "bench module end right",
    printDurationHours: 24,
    pelletUsageKg: 15,
    color: "#e2d9c7",
    borderColor: "#e2d9c7",
    shippingBoxType: "60x60x60"
  },
  {
    id: "bench-end-left",
    name: "bench module end left",
    printDurationHours: 24,
    pelletUsageKg: 15,
    color: "#ebe5da",
    borderColor: "#ebe5da",
    shippingBoxType: "60x60x60"
  },
  {
    id: "bench-without-backrest",
    name: "bench module without backrest",
    printDurationHours: 24,
    pelletUsageKg: 15,
    color: "#d3d0cb",
    borderColor: "#d3d0cb",
    shippingBoxType: "60x60x60"
  },
  {
    id: "len",
    name: "len",
    printDurationHours: 8.5,
    pelletUsageKg: 5.5,
    color: "#a1a3de",
    borderColor: "#a1a3de",
    shippingBoxType: "50x50x50"
  },
  {
    id: "len-4-leg",
    name: "len 4 leg",
    printDurationHours: 9.5,
    pelletUsageKg: 6.5,
    color: "#b1b2d2",
    borderColor: "#b1b2d2",
    shippingBoxType: "50x50x50"
  },
  {
    id: "len-m",
    name: "len m",
    printDurationHours: 6.5,
    pelletUsageKg: 5,
    color: "#b8bae7",
    borderColor: "#b8bae7",
    shippingBoxType: "42x42x33"
  },
  {
    id: "len-s",
    name: "len s",
    printDurationHours: 4.5,
    pelletUsageKg: 4.5,
    color: "#d0d1ef",
    borderColor: "#d0d1ef",
    shippingBoxType: "42x42x33"
  },
  {
    id: "fib",
    name: "fib",
    printDurationHours: 8.5,
    pelletUsageKg: 5.5,
    color: "#ef9263",
    borderColor: "#ef9263",
    shippingBoxType: "50x50x50"
  },
  {
    id: "fib-m",
    name: "fib m",
    printDurationHours: 6.5,
    pelletUsageKg: 5,
    color: "#f3ad8a",
    borderColor: "#f3ad8a",
    shippingBoxType: "42x42x33"
  },
  {
    id: "fib-s",
    name: "fib s",
    printDurationHours: 4.5,
    pelletUsageKg: 4.5,
    color: "#f7c9b1",
    borderColor: "#f7c9b1",
    shippingBoxType: "42x42x33"
  },
  {
    id: "ony",
    name: "ony",
    printDurationHours: 8.5,
    pelletUsageKg: 5.5,
    color: "#e6a5c4",
    borderColor: "#e6a5c4",
    shippingBoxType: "50x50x50"
  },
  {
    id: "inu",
    name: "inu",
    printDurationHours: 8.5,
    pelletUsageKg: 5.5,
    color: "#9aaf98",
    borderColor: "#9aaf98",
    shippingBoxType: "60x60x60"
  },
  {
    id: "inu-m",
    name: "inu m",
    printDurationHours: 6.5,
    pelletUsageKg: 5,
    color: "#b3c3b2",
    borderColor: "#b3c3b2",
    shippingBoxType: "60x60x60"
  },
  {
    id: "inu-s",
    name: "inu s",
    printDurationHours: 4.5,
    pelletUsageKg: 4.5,
    color: "#cdd7cb",
    borderColor: "#cdd7cb",
    shippingBoxType: "60x60x60"
  },
  {
    id: "piu",
    name: "piu",
    printDurationHours: 8.5,
    pelletUsageKg: 5.5,
    color: "#b9e6df",
    borderColor: "#b9e6df",
    shippingBoxType: "50x50x50"
  },
  {
    id: "banana-lamp-big",
    name: "banana lamp big",
    printDurationHours: 3.5,
    pelletUsageKg: 1.5,
    color: "#e0c588",
    borderColor: "#e0c588",
    shippingBoxType: "60x60x60"
  },
  {
    id: "banana-lamp-small",
    name: "banana lamp small",
    printDurationHours: 3,
    pelletUsageKg: 1,
    color: "#e8d4a6",
    borderColor: "#e8d4a6",
    shippingBoxType: "60x60x60"
  }
];

export const printRuns: PrintRun[] = [
  {
    id: "audo-copenhagen-sample",
    productId: "fib-s",
    project: "audo copenhagen sample",
    printerId: "printer-2",
    startDateTime: "2026-08-03T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-04T18:00:00",
    skipDeadlineBuffer: true
  },
  {
    id: "piu-airbnb",
    productId: "piu",
    project: "airbnb ersatz",
    printerId: "printer-1",
    startDateTime: "2026-08-03T10:00:00",
    status: "planned",
    priority: "urgent",
    note: "asap",
    skipDeadlineBuffer: true
  },
  {
    id: "ony-tenley-alabama",
    productId: "ony",
    project: "tenley alabama",
    printerId: "printer-1",
    startDateTime: "2026-08-04T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-06T18:00:00",
    skipDeadlineBuffer: true
  },
  {
    id: "copenhagen-bench-without-backrest-1",
    productId: "bench-without-backrest",
    project: "copenhagen kunstmesse",
    printerId: "printer-1",
    startDateTime: "2026-08-07T15:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-20T18:00:00",
    sequence: "1/2"
  },
  {
    id: "copenhagen-bench-without-backrest-2",
    productId: "bench-without-backrest",
    project: "copenhagen kunstmesse",
    printerId: "printer-2",
    startDateTime: "2026-08-07T15:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-26T18:00:00",
    sequence: "2/2"
  },
  {
    id: "schwarzwald-len",
    productId: "len",
    project: "schwarzwald",
    printerId: "printer-1",
    startDateTime: "2026-08-05T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-15T18:00:00",
    sequence: "1/3"
  },
  {
    id: "schwarzwald-ony",
    productId: "ony",
    project: "schwarzwald",
    printerId: "printer-1",
    startDateTime: "2026-08-06T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-15T18:00:00",
    sequence: "2/3"
  },
  {
    id: "schwarzwald-fib",
    productId: "fib",
    project: "schwarzwald",
    printerId: "printer-1",
    startDateTime: "2026-08-10T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-15T18:00:00",
    sequence: "3/3"
  },
  {
    id: "dresden-len",
    productId: "len",
    project: "dresden design days",
    printerId: "printer-2",
    startDateTime: "2026-08-10T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-18T18:00:00",
    sequence: "1/2"
  },
  {
    id: "dresden-inu",
    productId: "inu",
    project: "dresden design days",
    printerId: "printer-1",
    startDateTime: "2026-08-11T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-18T18:00:00",
    sequence: "2/2"
  },
  {
    id: "naa-len-1",
    productId: "len",
    project: "naa",
    printerId: "printer-1",
    startDateTime: "2026-08-12T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "1/15"
  },
  {
    id: "naa-len-2",
    productId: "len",
    project: "naa",
    printerId: "printer-1",
    startDateTime: "2026-08-13T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "2/15"
  },
  {
    id: "naa-len-3",
    productId: "len",
    project: "naa",
    printerId: "printer-1",
    startDateTime: "2026-08-14T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "3/15"
  },
  {
    id: "naa-len-4",
    productId: "len",
    project: "naa",
    printerId: "printer-1",
    startDateTime: "2026-08-17T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "4/15"
  },
  {
    id: "naa-len-5",
    productId: "len",
    project: "naa",
    printerId: "printer-1",
    startDateTime: "2026-08-18T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "5/15"
  },
  {
    id: "naa-ony-1",
    productId: "ony",
    project: "naa",
    printerId: "printer-1",
    startDateTime: "2026-08-19T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "6/15"
  },
  {
    id: "naa-ony-2",
    productId: "ony",
    project: "naa",
    printerId: "printer-1",
    startDateTime: "2026-08-20T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "7/15"
  },
  {
    id: "naa-ony-3",
    productId: "ony",
    project: "naa",
    printerId: "printer-1",
    startDateTime: "2026-08-21T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "8/15"
  },
  {
    id: "naa-ony-4",
    productId: "ony",
    project: "naa",
    printerId: "printer-1",
    startDateTime: "2026-08-24T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "9/15"
  },
  {
    id: "naa-inu-1",
    productId: "inu",
    project: "naa",
    printerId: "printer-1",
    startDateTime: "2026-08-25T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "10/15"
  },
  {
    id: "naa-inu-2",
    productId: "inu",
    project: "naa",
    printerId: "printer-1",
    startDateTime: "2026-08-26T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "11/15"
  },
  {
    id: "naa-fib-1",
    productId: "fib",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-20T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "12/15"
  },
  {
    id: "naa-fib-2",
    productId: "fib",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-21T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "13/15"
  },
  {
    id: "naa-fib-3",
    productId: "fib",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-24T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "14/15"
  },
  {
    id: "naa-piu-1",
    productId: "piu",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-25T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "15/15"
  },
  {
    id: "naa-lamp-big-1",
    productId: "banana-lamp-big",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-04T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "1/10"
  },
  {
    id: "naa-lamp-big-2",
    productId: "banana-lamp-big",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-05T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "2/10"
  },
  {
    id: "naa-lamp-big-3",
    productId: "banana-lamp-big",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-06T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "3/10"
  },
  {
    id: "naa-lamp-big-4",
    productId: "banana-lamp-big",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-11T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "4/10"
  },
  {
    id: "naa-lamp-big-5",
    productId: "banana-lamp-big",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-12T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "5/10"
  },
  {
    id: "naa-lamp-big-6",
    productId: "banana-lamp-big",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-13T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "6/10"
  },
  {
    id: "naa-lamp-big-7",
    productId: "banana-lamp-big",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-14T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "7/10"
  },
  {
    id: "naa-lamp-big-8",
    productId: "banana-lamp-big",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-17T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "8/10"
  },
  {
    id: "naa-lamp-big-9",
    productId: "banana-lamp-big",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-18T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "9/10"
  },
  {
    id: "naa-lamp-big-10",
    productId: "banana-lamp-big",
    project: "naa",
    printerId: "printer-2",
    startDateTime: "2026-08-19T10:00:00",
    status: "planned",
    priority: "normal",
    customerDeadline: "2026-08-27T18:00:00",
    sequence: "10/10"
  }
];

export const studioTasks: StudioTask[] = [];

export const pelletInventory = {
  currentStockKg: 75,
  reorderThresholdKg: 20
};
