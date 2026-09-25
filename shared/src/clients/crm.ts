import { API_V1 } from '../api/endpoints';
import type {
  CrmOverview,
  CustomerDetail,
  CustomerOrdersResponse,
  CustomerSegment,
  SegmentCount,
} from '../api/types';
import { createApiClient, type ApiClientOptionsPatch, unwrap } from './client';

/** CRM admin client (admin-only system). */
export const crmAdminApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });

  return {
    client,
    getOverview: async (): Promise<CrmOverview> => unwrap(client.get(API_V1.crm.overview)),
    getSegments: async (): Promise<SegmentCount[]> => unwrap(client.get(API_V1.crm.segments)),
    getCustomers: async (params: Record<string, unknown> = {}): Promise<CustomerOrdersResponse> =>
      unwrap(client.get(API_V1.crm.customers.root, { params })),
    getCustomer: async (id: string): Promise<CustomerDetail> =>
      unwrap(client.get(API_V1.crm.customers.byId(id))),
    updateCustomer: async (
      id: string,
      data: Partial<{
        name: string;
        email: string | null;
        governorate: string | null;
        address: string | null;
        tags: string[];
        segment: CustomerSegment;
      }>
    ): Promise<void> => unwrap(client.put(API_V1.crm.customers.byId(id), data)),
    addNote: async (id: string, note: string): Promise<void> =>
      unwrap(client.post(API_V1.crm.customers.notes(id), { note })),
    backfill: async () => unwrap(client.post(API_V1.crm.backfill)),
  };
};