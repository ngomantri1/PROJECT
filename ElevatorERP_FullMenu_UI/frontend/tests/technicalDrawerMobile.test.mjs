import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const editorSource = readFileSync(
  new URL('../src/components/ConsultationProfileEditDrawer.tsx', import.meta.url),
  'utf8',
);
const listSource = readFileSync(new URL('../src/app/customers/page.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

test('hai luồng cấu hình kỹ thuật dùng chung Drawer mobile toàn viewport', () => {
  assert.match(editorSource, /rootClassName='technical-config-drawer-root'/);
  assert.match(listSource, /rootClassName='technical-config-drawer-root'/);
  assert.match(cssSource, /technical-config-drawer-root \.ant-drawer-content-wrapper\{width:100vw!important;max-width:100vw!important;height:100dvh!important/);
  assert.match(cssSource, /technical-config-drawer \.ant-drawer-body\{min-width:0;padding:14px 14px calc\(88px \+ env\(safe-area-inset-bottom\)\)!important;overflow-x:hidden\}/);
});

test('mobile có bộ chọn đúng thang, thêm thang và menu theo đúng chế độ nghiệp vụ', () => {
  assert.match(editorSource, /className=\{`technical-mobile-toolbar \$\{isSingleConfiguration \? 'is-single' : ''\}`\}/);
  assert.match(editorSource, /value=\{editingIndex\}/);
  assert.match(editorSource, /onChange=\{switchTechnical\}/);
  assert.match(editorSource, /options=\{configurations\.map/);
  assert.match(editorSource, /isSingleConfiguration\s*\? <div className='technical-mobile-single-label'/);
  assert.match(editorSource, /!isSingleConfiguration && editingIndex !== undefined && <Dropdown/);
  assert.match(cssSource, /technical-tab-row\.is-single\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test('footer và trường nhập cấu hình không tràn khỏi viewport mobile', () => {
  assert.match(cssSource, /technical-config-drawer \.technical-drawer-footer\{align-items:center;flex-direction:row;min-width:0\}/);
  assert.match(cssSource, /technical-config-drawer \.ant-input-number,[\s\S]*technical-config-drawer \.ant-select\{width:100%!important;max-width:100%\}/);
  assert.match(cssSource, /floor-height-row\{grid-template-columns:1fr 1fr 42px/);
});
