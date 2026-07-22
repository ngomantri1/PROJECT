export type Customer360Summary = {
  consultationProfileCount: number;
  consultationConfigurationCount: number;
  customerElevatorCount: number;
};

export const customer360EntityLabels = {
  consultationConfiguration: 'Cấu hình tư vấn',
  elevatorAsset: 'Thang máy',
} as const;

export const customer360TabOrder = [
  'overview',
  'profiles',
  'quotations',
  'contracts',
  'elevators',
  'receivables',
  'progress',
  'maintenance',
  'care',
  'history',
] as const;

export function customer360EntityCounts(summary: Customer360Summary) {
  return {
    consultationProfiles: summary.consultationProfileCount,
    consultationConfigurations: summary.consultationConfigurationCount,
    elevatorAssets: summary.customerElevatorCount,
  };
}

type CustomerReturnTo = 'customers' | 'consultation-profiles';

export function consultationProfileHref(
  profileId: string,
  context?: { customerId: string; customerReturnTo: CustomerReturnTo },
) {
  if (!context) return `/consultation-profiles/${profileId}`;
  const query = new URLSearchParams({
    returnTo: 'customer360',
    customerId: context.customerId,
    customerReturnTo: context.customerReturnTo,
  });
  return `/consultation-profiles/${profileId}?${query.toString()}`;
}

export function customer360ProfileHref(customerId: string, profileId: string, customerReturnTo: CustomerReturnTo) {
  const query = new URLSearchParams({
    tab: 'profiles',
    profileId,
    returnTo: customerReturnTo,
  });
  return `/business/customers/${customerId}?${query.toString()}`;
}

export function customer360BackLabel(customerName: string) {
  return `Quay lại Customer 360 – ${customerName}`;
}

export function consultationProfileEditHref(
  profileId: string,
  context?: { customerId: string; customerReturnTo: CustomerReturnTo },
) {
  const query = new URLSearchParams({ profileId });
  if (context) {
    query.set('returnTo', 'customer360');
    query.set('returnCustomerId', context.customerId);
    query.set('customerReturnTo', context.customerReturnTo);
  }
  return `/customers?${query.toString()}`;
}

export function consultationConfigurationViewHref(
  profileId: string,
  configurationId: string,
  customerId: string,
  customerReturnTo: CustomerReturnTo,
) {
  const query = new URLSearchParams({
    returnTo: 'customer360',
    customerId,
    customerReturnTo,
  });
  return `/consultation-profiles/${profileId}/configurations/${configurationId}?${query.toString()}`;
}
