import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consultationConfigurationViewHref,
  consultationProfileEditHref,
  consultationProfileHref,
  customer360BackLabel,
  customer360EntityCounts,
  customer360EntityLabels,
  customer360ProfileHref,
  customer360TabOrder,
} from '../src/lib/customer360.ts';

test('tách bộ đếm cấu hình tư vấn khỏi thang máy tài sản', () => {
  const counts = customer360EntityCounts({
    consultationProfileCount: 2,
    consultationConfigurationCount: 5,
    customerElevatorCount: 1,
  });

  assert.deepEqual(counts, {
    consultationProfiles: 2,
    consultationConfigurations: 5,
    elevatorAssets: 1,
  });
});

test('dùng nhãn tiếng Việt rõ nghĩa cho hai loại dữ liệu', () => {
  assert.equal(customer360EntityLabels.consultationConfiguration, 'Cấu hình tư vấn');
  assert.equal(customer360EntityLabels.elevatorAsset, 'Thang máy');
});

test('liên kết đăng ký nguồn mở đúng đăng ký tư vấn', () => {
  assert.equal(consultationProfileHref('profile-123'), '/consultation-profiles/profile-123');
});

test('đăng ký mở từ Customer 360 giữ lại ngữ cảnh khách hàng', () => {
  assert.equal(
    consultationProfileHref('profile-123', { customerId: 'customer-789', customerReturnTo: 'consultation-profiles' }),
    '/consultation-profiles/profile-123?returnTo=customer360&customerId=customer-789&customerReturnTo=consultation-profiles',
  );
  assert.equal(
    customer360ProfileHref('customer-789', 'profile-123', 'consultation-profiles'),
    '/business/customers/customer-789?tab=profiles&profileId=profile-123&returnTo=consultation-profiles',
  );
  assert.equal(customer360BackLabel('Ngô Minh Tú'), 'Quay lại Customer 360 – Ngô Minh Tú');
  const editHref = consultationProfileEditHref('profile-123', { customerId: 'customer-789', customerReturnTo: 'consultation-profiles' });
  assert.equal(
    editHref,
    '/customers?profileId=profile-123&returnTo=customer360&returnCustomerId=customer-789&customerReturnTo=consultation-profiles',
  );
  const editUrl = new URL(editHref, 'http://localhost');
  assert.equal(editUrl.searchParams.get('customerId'), null, 'không được kích hoạt nhầm luồng tạo hồ sơ mới');
  assert.equal(editUrl.searchParams.get('returnCustomerId'), 'customer-789');
});

test('xếp thang máy tài sản sau hợp đồng theo vòng đời nghiệp vụ', () => {
  assert.deepEqual(customer360TabOrder.slice(1, 5), [
    'profiles',
    'quotations',
    'contracts',
    'elevators',
  ]);
});

test('liên kết xem cấu hình mở chế độ chỉ đọc và giữ đường quay lại Customer 360', () => {
  assert.equal(
    consultationConfigurationViewHref('profile-123', 'config-456', 'customer-789', 'consultation-profiles'),
    '/consultation-profiles/profile-123/configurations/config-456?returnTo=customer360&customerId=customer-789&customerReturnTo=consultation-profiles',
  );
});
