import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCustomerFilterQuery,
  cloneCustomerAdvancedFilters,
  countCustomerAdvancedFilters,
} from '../src/lib/customerFilters.ts';

test('dựng đúng query lọc khách hàng và chuẩn hóa khoảng trắng', () => {
  const query = new URLSearchParams(buildCustomerFilterQuery({
    search: '  KH-000027  ',
    status: 'CARING',
    customerType: 'PERSONAL',
    source: 'Marketing',
    owner: 'Phạm Xuân Tùng',
    address: '  Hạc Thành  ',
    createdFrom: '2026-07-01T00:00:00.000Z',
    createdTo: '2026-07-31T23:59:59.999Z',
  }));

  assert.deepEqual(Object.fromEntries(query), {
    search: 'KH-000027',
    status: 'CARING',
    customerType: 'PERSONAL',
    source: 'Marketing',
    owner: 'Phạm Xuân Tùng',
    address: 'Hạc Thành',
    createdFrom: '2026-07-01T00:00:00.000Z',
    createdTo: '2026-07-31T23:59:59.999Z',
  });
});

test('bộ đếm coi khoảng ngày là một điều kiện', () => {
  assert.equal(countCustomerAdvancedFilters({
    status: 'NEW',
    address: 'Thanh Hóa',
    createdFrom: '2026-07-01T00:00:00.000Z',
    createdTo: '2026-07-31T23:59:59.999Z',
  }), 3);
});

test('bản nháp độc lập với bộ lọc đang áp dụng để Hủy không đổi danh sách', () => {
  const applied = { status: 'NEW', source: 'Marketing' };
  const draft = cloneCustomerAdvancedFilters(applied);
  draft.status = 'CARING';

  assert.equal(applied.status, 'NEW');
  assert.equal(draft.status, 'CARING');
});

test('không đưa điều kiện loại thang hoặc cấu hình vào khách hàng master', () => {
  const query = new URLSearchParams(buildCustomerFilterQuery({ status: 'NEW' }));
  assert.equal(query.has('elevatorType'), false);
  assert.equal(query.has('elevatorTypes'), false);
  assert.equal(query.has('technicalConfiguration'), false);
});
