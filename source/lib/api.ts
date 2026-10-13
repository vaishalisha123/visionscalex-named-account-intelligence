const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function apiPost<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "detail" in body && typeof (body as { detail?: unknown }).detail === "string") {
        detail = (body as { detail: string }).detail;
      }
    } catch {}
    throw new Error(`API ${response.status}: ${detail}`);
  }

  return response.json();
}
async function apiPatch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === "object" &&
        "detail" in body &&
        typeof (body as { detail?: unknown }).detail === "string"
      ) {
        detail = (body as { detail: string }).detail;
      }
    } catch {}
    throw new Error(`API ${response.status}: ${detail}`);
  }

  return response.json();
}

async function apiPut<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "detail" in body && typeof (body as { detail?: unknown }).detail === "string") {
        detail = (body as { detail: string }).detail;
      }
    } catch {}
    throw new Error(`API ${response.status}: ${detail}`);
  }
  return response.json();
}

async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === "object" &&
        "detail" in body &&
        typeof (body as { detail?: unknown }).detail === "string"
      ) {
        detail = (body as { detail: string }).detail;
      }
    } catch {}
    throw new Error(`API ${response.status}: ${detail}`);
  }

  return response.json();
}

function cleanUrl(value: string | null | undefined): string {
  if (!value) return "";

  const markdownMatch = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (markdownMatch) return markdownMatch[2];

  return value;
}

export const api = {
  getClients: async () => {
    const response = await apiGet<
      | Array<{
          id: number;
          company_name: string;
          website: string | null;
          linkedin_url: string | null;
          bu_in_focus: string | null;
        }>
      | {
          value: Array<{
            id: number;
            company_name: string;
            website: string | null;
            linkedin_url: string | null;
            bu_in_focus: string | null;
          }>;
          Count?: number;
        }
    >("/clients");

    return Array.isArray(response) ? response : response.value;
  },
  createClient: (payload: {
    company_name: string;
    website?: string;
    linkedin_url?: string;
    bu_in_focus?: string;
  }) =>
    apiPost<{
      id: number;
      company_name: string;
      website: string | null;
      linkedin_url: string | null;
      bu_in_focus: string | null;
    }>("/clients", payload),

  getClient: (clientId: number) =>
    apiGet<{
      id: number;
      company_name: string;
      website: string | null;
      linkedin_url: string | null;
      bu_in_focus: string | null;
    }>(`/clients/${clientId}`),
    deleteClient: (clientId: number) =>
  apiDelete<{ message: string; client_id: number }>(
    `/clients/${clientId}`
  ),

  deleteAccount: (
    clientId: number,
    accountId: number
  ) =>
    apiDelete<{
      message: string;
      account_id: number;
      account_name: string;
      client_id: number;
      client_name: string;
    }>(`/clients/${clientId}/accounts/${accountId}`),

  getAccounts: (clientId: number) =>
    apiGet<Array<{
      id: number;
      client_id: number;
      account_name: string;
      website: string | null;
      linkedin_url: string | null;
    }>>(`/clients/${clientId}/accounts`),

  createAccount: (clientId: number, payload: {
    account_name: string;
    website: string;
    linkedin_url?: string;
  }) =>
    apiPost(`/clients/${clientId}/accounts`, payload),

  getClientContext: (clientId: number) =>
    apiGet<{
      id: number;
      client_id: number;
      cc_location: string[];
      cc_description: string;
      cc_services_being_sold: string[];
      cc_service_description: { service: string; description: string }[];
      cc_typical_promblems_we_solve: string[];
      cc_typical_engagements: string[];
      cc_ideal_buying_situations: string[];
      cc_known_affairs_subsidiaries: string[];
      cc_parent_company: string;
      cc_alternate_names_abbreviations: string[];
    }>(`/clients/${clientId}/context`),

  updateClientContext: (clientId: number, payload: {
    cc_location: string[];
    cc_description: string;
    cc_services_being_sold: string[];
    cc_service_description: { service: string; description: string }[];
    cc_typical_promblems_we_solve: string[];
    cc_typical_engagements: string[];
    cc_ideal_buying_situations: string[];
    cc_known_affairs_subsidiaries: string[];
    cc_parent_company: string;
    cc_alternate_names_abbreviations: string[];
  }) => apiPut(`/clients/${clientId}/context`, payload),

  generateClientContext: (clientId: number) =>
  apiPost<{
    id: number;
    client_id: number;
    cc_location: string[];
    cc_description: string;
    cc_services_being_sold: string[];
    cc_service_description: { service: string; description: string }[];
    cc_typical_promblems_we_solve: string[];
    cc_typical_engagements: string[];
    cc_ideal_buying_situations: string[];
    cc_known_affairs_subsidiaries: string[];
    cc_parent_company: string;
    cc_alternate_names_abbreviations: string[];
  }>(`/clients/${clientId}/context/generate`),


  getSignals: (clientId: number) => apiGet(`/clients/${clientId}/signals`),
  generateSignals: (clientId: number) =>
      apiPost(`/clients/${clientId}/signals/generate`),

  toggleSignal: (clientId: number, signalId: number) =>
  apiPatch<{
    id: number;
    client_id: number;
    enabled: boolean;
  }>(`/clients/${clientId}/signals/${signalId}/toggle`),

  getAccountIntelligence: (clientId: number, accountId: number) =>
  apiGet<{
    id: number;
    account_id: number;
    website_scraped_text: string;
    cc_location: string[];
    cc_description: string;
    cc_services_being_sold: string[];
    cc_service_description: unknown[];
    cc_typical_promblems_we_solve: string[];
    cc_typical_engagements: string[];
    cc_ideal_buying_situations: string[];
    cc_known_affairs_subsidiaries: string[];
    cc_parent_company: string;
    cc_alternate_names_abbreviations: string[];
  }>(`/clients/${clientId}/accounts/${accountId}/intelligence`),

  generateAccountIntelligence: (clientId: number, accountId: number) =>
    apiPost(`/clients/${clientId}/accounts/${accountId}/intelligence/generate`),

  getAccountSignals: (clientId: number, accountId: number) =>
    apiGet(`/clients/${clientId}/accounts/${accountId}/signals`),
  generateAccountSignalQueries: (clientId: number, accountId: number) =>
   apiPost(
    `/clients/${clientId}/accounts/${accountId}/signals/generate`
  ),
  generateAllAccountSignalQueries: (clientId: number,regionInFocus: string) =>
   apiPost(
    `/clients/${clientId}/account-signals/generate`, {
    region_in_focus: regionInFocus,
 }),
  getAccountSignalQueryProgress: async (clientId: number) => {
  return await apiGet<{
    status: string;
    completed: number;
    total: number;
    current_account?: string | null;
    current_signal?: string | null;
    error?: string | null;
  }>(`/clients/${clientId}/account-signals/progress`);
},

  getSearchResults: (clientId: number, accountId: number) =>
    apiGet(`/clients/${clientId}/accounts/${accountId}/search-results`),

  getRelevancyResults: (clientId: number, accountId: number) =>
    apiGet(`/clients/${clientId}/accounts/${accountId}/relevancy-results`),

  getQBCResults: (clientId: number, accountId: number) =>
    apiGet(`/clients/${clientId}/accounts/${accountId}/qbc-results`),

  getAccountDashboard: (clientId: number, accountId: number) =>
    apiGet(`/clients/${clientId}/accounts/${accountId}/dashboard`),

  cleanUrl,
};



