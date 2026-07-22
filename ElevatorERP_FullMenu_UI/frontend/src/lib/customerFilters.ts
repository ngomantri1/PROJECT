export type CustomerAdvancedFilters = {
  status?: string;
  customerType?: string;
  source?: string;
  owner?: string;
  address?: string;
  createdFrom?: string;
  createdTo?: string;
};

export type CustomerListFilters = CustomerAdvancedFilters & {
  search?: string;
};

export const emptyCustomerAdvancedFilters: CustomerAdvancedFilters = {};

export function cloneCustomerAdvancedFilters(filters: CustomerAdvancedFilters): CustomerAdvancedFilters {
  return { ...filters };
}

export function buildCustomerFilterQuery(filters: CustomerListFilters) {
  const params = new URLSearchParams();
  const search = filters.search?.trim();
  const address = filters.address?.trim();

  if (search) params.set('search', search);
  if (filters.status) params.set('status', filters.status);
  if (filters.customerType) params.set('customerType', filters.customerType);
  if (filters.source) params.set('source', filters.source);
  if (filters.owner) params.set('owner', filters.owner);
  if (address) params.set('address', address);
  if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
  if (filters.createdTo) params.set('createdTo', filters.createdTo);

  return params.toString();
}

export function countCustomerAdvancedFilters(filters: CustomerAdvancedFilters) {
  return [
    filters.status,
    filters.customerType,
    filters.source,
    filters.owner,
    filters.address?.trim(),
    filters.createdFrom || filters.createdTo ? 'createdRange' : undefined,
  ].filter(Boolean).length;
}
