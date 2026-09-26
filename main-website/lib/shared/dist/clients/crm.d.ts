import type { CrmOverview, CustomerDetail, CustomerOrdersResponse, CustomerSegment, SegmentCount } from '../api/types';
import { type ApiClientOptionsPatch } from './client';
/** CRM admin client (admin-only system). */
export declare const crmAdminApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: import("axios").AxiosInstance;
    getOverview: () => Promise<CrmOverview>;
    getSegments: () => Promise<SegmentCount[]>;
    getCustomers: (params?: Record<string, unknown>) => Promise<CustomerOrdersResponse>;
    getCustomer: (id: string) => Promise<CustomerDetail>;
    updateCustomer: (id: string, data: Partial<{
        name: string;
        email: string | null;
        governorate: string | null;
        address: string | null;
        tags: string[];
        segment: CustomerSegment;
    }>) => Promise<void>;
    addNote: (id: string, note: string) => Promise<void>;
    backfill: () => Promise<unknown>;
};
