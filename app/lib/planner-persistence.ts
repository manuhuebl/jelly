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

export type LoadedPlannerState = {
  source: "empty" | "local" | "remote";
  state: StoredPlannerState | null;
  updatedAt: string | null;
};

type StoredPlannerEnvelope = {
  remoteUpdatedAt?: string | null;
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

function saveLocalPlannerState(state: StoredPlannerState, remoteUpdatedAt?: string | null) {
  if (typeof window === "undefined") {
    return null;
  }

  const envelope: StoredPlannerEnvelope = {
    remoteUpdatedAt,
    savedAt: new Date().toISOString(),
    state
  };

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(envelope));

  return envelope;
}

export async function loadPlannerState() {
  const localState = loadLocalPlannerState();

  if (!isSupabaseConfigured()) {
    return {
      source: localState ? "local" : "empty",
      state: localState?.state ?? null,
      updatedAt: localState?.remoteUpdatedAt ?? null
    } satisfies LoadedPlannerState;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/planner_state?id=eq.${STATE_ID}&select=state,updated_at`,
        {
          headers: getHeaders(),
          signal: controller.signal
        }
      );

      if (!response.ok) {
        if (attempt === 0) {
          continue;
        }

        if (localState) {
          return {
            source: "local",
            state: localState.state,
            updatedAt: localState.remoteUpdatedAt ?? null
          } satisfies LoadedPlannerState;
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
        (!remoteState ||
          (localState.remoteUpdatedAt === remoteState.updated_at &&
            new Date(localState.savedAt) > new Date(remoteState.updated_at)))
      ) {
        return {
          source: "local",
          state: localState.state,
          updatedAt: localState.remoteUpdatedAt ?? remoteState?.updated_at ?? null
        } satisfies LoadedPlannerState;
      }

      return {
        source: remoteState ? "remote" : localState ? "local" : "empty",
        state: remoteState?.state ?? localState?.state ?? null,
        updatedAt: remoteState?.updated_at ?? localState?.remoteUpdatedAt ?? null
      } satisfies LoadedPlannerState;
    } catch (error) {
      if (attempt === 0) {
        continue;
      }

      if (localState) {
        return {
          source: "local",
          state: localState.state,
          updatedAt: localState.remoteUpdatedAt ?? null
        } satisfies LoadedPlannerState;
      }

      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return {
    source: "empty",
    state: null,
    updatedAt: null
  } satisfies LoadedPlannerState;
}

export async function savePlannerState(
  state: StoredPlannerState,
  remoteUpdatedAt: string | null
) {
  saveLocalPlannerState(state, remoteUpdatedAt);

  if (!isSupabaseConfigured()) {
    return remoteUpdatedAt;
  }

  const nextUpdatedAt = new Date().toISOString();
  const payload = JSON.stringify({
    state,
    updated_at: nextUpdatedAt
  });

  const saveUrl = remoteUpdatedAt
    ? `${SUPABASE_URL}/rest/v1/planner_state?id=eq.${STATE_ID}&updated_at=eq.${encodeURIComponent(
        remoteUpdatedAt
      )}&select=updated_at`
    : `${SUPABASE_URL}/rest/v1/planner_state?on_conflict=id&select=updated_at`;
  const saveMethod = remoteUpdatedAt ? "PATCH" : "POST";
  const saveBody = remoteUpdatedAt
    ? payload
    : JSON.stringify({
        id: STATE_ID,
        state,
        updated_at: nextUpdatedAt
      });

  const response = await fetch(saveUrl, {
    body: saveBody,
    headers: {
      ...getHeaders(),
      Prefer: remoteUpdatedAt
        ? "return=representation"
        : "resolution=merge-duplicates,return=representation"
    },
    method: saveMethod
  });

  if (!response.ok) {
    await new Promise((resolve) => window.setTimeout(resolve, 800));

    const retryResponse = await fetch(saveUrl, {
      body: saveBody,
      headers: {
        ...getHeaders(),
        Prefer: remoteUpdatedAt
          ? "return=representation"
          : "resolution=merge-duplicates,return=representation"
      },
      method: saveMethod
    });

    if (!retryResponse.ok) {
      const message = await retryResponse.text();

      throw new Error(
        `Could not save planner state: ${retryResponse.status}${message ? ` ${message}` : ""}`
      );
    }

    const retryRows = (await retryResponse.json()) as Array<{ updated_at: string }>;

    if (remoteUpdatedAt && retryRows.length === 0) {
      throw new Error("Planner changed elsewhere. Reload before saving again.");
    }

    const retryUpdatedAt = retryRows[0]?.updated_at ?? nextUpdatedAt;
    saveLocalPlannerState(state, retryUpdatedAt);

    return retryUpdatedAt;
  }

  const rows = (await response.json()) as Array<{ updated_at: string }>;

  if (remoteUpdatedAt && rows.length === 0) {
    throw new Error("Planner changed elsewhere. Reload before saving again.");
  }

  const updatedAt = rows[0]?.updated_at ?? nextUpdatedAt;
  saveLocalPlannerState(state, updatedAt);

  return updatedAt;
}
