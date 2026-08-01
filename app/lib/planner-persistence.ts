import type { PrintRun, Product } from "../data/planner-data";

export type StoredPlannerState = {
  materialStockKg: number;
  manualProductInventory: Record<string, number>;
  productData: Product[];
  runs: PrintRun[];
  timelineEvents: Array<{
    color?: string;
    endDateTime: string;
    id: string;
    startDateTime: string;
    tagLabel?: string;
    title: string;
    type: string;
  }>;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const STATE_ID = "production-planner";
const LOCAL_STORAGE_KEY = "jelly-production-planner-state";

type StoredPlannerEnvelope = {
  savedAt: string;
  state: StoredPlannerState;
};

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function getHeaders() {
  return {
    apikey: SUPABASE_KEY ?? "",
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal"
  };
}

function loadLocalPlannerState() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue) as StoredPlannerEnvelope;
  } catch {
    return null;
  }
}

function saveLocalPlannerState(state: StoredPlannerState) {
  if (typeof window === "undefined") {
    return null;
  }

  const envelope: StoredPlannerEnvelope = {
    savedAt: new Date().toISOString(),
    state
  };

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(envelope));

  return envelope;
}

export async function loadPlannerState() {
  const localState = loadLocalPlannerState();

  if (!isSupabaseConfigured()) {
    return localState?.state ?? null;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/planner_state?id=eq.${STATE_ID}&select=state,updated_at`,
      {
        headers: getHeaders(),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      if (localState) {
        return localState.state;
      }

      throw new Error(`Could not load planner state: ${response.status}`);
    }

    const rows = (await response.json()) as Array<{
      state: StoredPlannerState;
      updated_at: string;
    }>;
    const remoteState = rows[0];

    if (
      localState &&
      (!remoteState || new Date(localState.savedAt) > new Date(remoteState.updated_at))
    ) {
      return localState.state;
    }

    return remoteState?.state ?? localState?.state ?? null;
  } catch (error) {
    if (localState) {
      return localState.state;
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function savePlannerState(state: StoredPlannerState) {
  saveLocalPlannerState(state);

  if (!isSupabaseConfigured()) {
    return;
  }

  const payload = JSON.stringify({
    id: STATE_ID,
    state,
    updated_at: new Date().toISOString()
  });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/planner_state?on_conflict=id`, {
    body: payload,
    headers: getHeaders(),
    method: "POST"
  });

  if (!response.ok) {
    await new Promise((resolve) => window.setTimeout(resolve, 800));

    const retryResponse = await fetch(`${SUPABASE_URL}/rest/v1/planner_state?on_conflict=id`, {
      body: payload,
      headers: getHeaders(),
      method: "POST"
    });

    if (!retryResponse.ok) {
      const message = await retryResponse.text();

      throw new Error(
        `Could not save planner state: ${retryResponse.status}${message ? ` ${message}` : ""}`
      );
    }
  }
}
