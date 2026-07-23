import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const listSource = readFileSync(new URL('../src/app/customers/page.tsx', import.meta.url), 'utf8');

test('tên khách hàng trên thẻ mobile mở đúng Customer 360 và giữ đăng ký đang chọn', () => {
  const mobileCardsStart = listSource.indexOf("<div className='mobile-card-list section-gap'>");
  const mobileCardsEnd = listSource.indexOf('<DrawerForm<CustomerForm>', mobileCardsStart);
  const mobileCardsSource = listSource.slice(mobileCardsStart, mobileCardsEnd);

  assert.match(mobileCardsSource, /className='record-link table-primary-text mobile-customer360-link'/);
  assert.match(mobileCardsSource, /aria-label=\{`Mở Customer 360 của \$\{customer\.name\}`\}/);
  assert.match(
    mobileCardsSource,
    /router\.push\(`\/business\/customers\/\$\{customer\.customerId \?\? customer\.id\}\?tab=profiles&profileId=\$\{customer\.id\}&returnTo=consultation-profiles`\)/,
  );
});
