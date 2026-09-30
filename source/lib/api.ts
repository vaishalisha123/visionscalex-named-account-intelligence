const API_BASE_URL = "http://127.0.0.1:8000";

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  getClients: () =>
    apiGet("/clients"),

  getClient: (clientId: number) =>
    apiGet(`/clients/${clientId}`),

  getAccounts: (clientId: number) =>
    apiGet(`/clients/${clientId}/accounts`),

  getClientContext: (clientId: number) =>
    apiGet(`/clients/${clientId}/context`),

  getSignals: (clientId: number) =>
    apiGet(`/clients/${clientId}/signals`),

  getAccountIntelligence: (clientId: number, accountId: number) =>
    apiGet(`/clients/${clientId}/accounts/${accountId}/intelligence`),

  getAccountSignals: (clientId: number, accountId: number) =>
    apiGet(`/clients/${clientId}/accounts/${accountId}/signals`),

  getSearchResults: (clientId: number, accountId: number) =>
    apiGet(`/clients/${clientId}/accounts/${accountId}/search-results`),

  getRelevancyResults: (clientId: number, accountId: number) =>
    apiGet(`/clients/${clientId}/accounts/${accountId}/relevancy-results`),

  getQBCResults: (clientId: number, accountId: number) =>
    apiGet(`/clients/${clientId}/accounts/${accountId}/qbc-results`),

  getAccountDashboard: (clientId: number, accountId: number) =>
    apiGet(`/clients/${clientId}/accounts/${accountId}/dashboard`),
};
