import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const detailSource = readFileSync(
  new URL('../src/app/consultation-profiles/[id]/page.tsx', import.meta.url),
  'utf8',
);

test('các tab chi tiết đăng ký tư vấn có icon đồng nhất với Customer 360', () => {
  assert.match(detailSource, /const detailTabIcons: Record<DetailTab, ReactNode>/);
  assert.match(detailSource, /overview: <AppstoreOutlined \/>/);
  assert.match(detailSource, /requirements: <SlidersOutlined \/>/);
  assert.match(detailSource, /quotations: <FileTextOutlined \/>/);
  assert.match(detailSource, /contracts: <SafetyCertificateOutlined \/>/);
  assert.match(detailSource, /history: <HistoryOutlined \/>/);
  assert.match(detailSource, /className='customer-360-tab-label'/);
  assert.match(detailSource, /label: detailTabLabel\(item\.key as DetailTab, item\.label\)/);
  assert.match(detailSource, /items=\{tabItemsWithIcons\}/);
});
