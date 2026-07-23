import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  cloneConsultationConfiguration,
  parseConsultationConfigurations,
  technicalConfigurationErrors,
} from '../src/lib/consultationProfileEditor.ts';

const validConfiguration = {
  id: 'elevator-1',
  name: 'Thang máy 1',
  elevatorType: 'BUILT',
  floors: 2,
  capacityKg: 450,
  counterweightPosition: 'BACK',
  shaftWidthMm: 1500,
  shaftDepthMm: 1500,
  pitDepthMm: 1400,
  machineRoomHeightMm: 1200,
  overheadHeightMm: 4200,
  installationAddress: 'Hạc Thành, Thanh Hóa',
  latitude: 19.8071,
  longitude: 105.7763,
  floorHeights: [
    { id: 'floor-1', floorName: 'Tầng 1', heightMm: 3600 },
    { id: 'floor-2', floorName: 'Tầng 2', heightMm: 3600 },
  ],
  attachments: [{ id: 'survey-1', name: 'Ảnh khảo sát' }],
};

test('cấu hình đầy đủ vượt qua validation dùng chung', () => {
  assert.deepEqual(technicalConfigurationErrors(validConfiguration), []);
});

test('validation phát hiện thiếu vị trí và sai số dòng tầng', () => {
  const errors = technicalConfigurationErrors({
    ...validConfiguration,
    latitude: undefined,
    longitude: undefined,
    floorHeights: validConfiguration.floorHeights.slice(0, 1),
  });

  assert.ok(errors.includes('Vị trí ghim triển khai'));
  assert.ok(errors.includes('Chiều cao từng tầng'));
});

test('nhân bản cấu hình không sao chép tài liệu khảo sát', () => {
  const cloned = cloneConsultationConfiguration(validConfiguration, 'elevator-2');
  assert.equal(cloned.name, 'Thang máy 1 - Bản sao');
  assert.deepEqual(cloned.attachments, []);
  assert.notEqual(cloned.floorHeights?.[0].id, validConfiguration.floorHeights[0].id);
});

test('đọc đầy đủ nhiều thang từ đăng ký tư vấn', () => {
  const configurations = parseConsultationConfigurations(JSON.stringify([
    validConfiguration,
    { ...validConfiguration, id: 'elevator-2', name: 'Thang máy 2' },
  ]));

  assert.equal(configurations.length, 2);
  assert.deepEqual(configurations.map((item) => item.name), ['Thang máy 1', 'Thang máy 2']);
});

test('danh sách thang chỉ cho sửa; nhân bản và xóa nằm trong cấu hình chi tiết', () => {
  const editorSource = readFileSync(
    new URL('../src/components/ConsultationProfileEditDrawer.tsx', import.meta.url),
    'utf8',
  );
  const summaryStart = editorSource.indexOf("<div className='customer-supplement-section'>");
  const technicalDrawerStart = editorSource.indexOf("<Drawer title={<span className='technical-drawer-title'>");
  const summarySource = editorSource.slice(summaryStart, technicalDrawerStart);
  const technicalDrawerSource = editorSource.slice(technicalDrawerStart);

  assert.match(summarySource, /aria-label='Sửa cấu hình thang'/);
  assert.doesNotMatch(summarySource, /Nhân bản cấu hình|Xóa cấu hình/);
  assert.match(technicalDrawerSource, /label: 'Nhân bản cấu hình'/);
  assert.match(technicalDrawerSource, /label: 'Xóa cấu hình'/);
  assert.match(technicalDrawerSource, /overlayClassName='technical-action-dropdown'/);
  assert.match(technicalDrawerSource, /overlayStyle=\{\{ zIndex: 1700 \}\}/);
  assert.match(technicalDrawerSource, /getPopupContainer=\{\(\) => document\.body\}/);
});

test('khu vực lắp đặt chỉ lấy tự động từ vị trí ghim, không cho nhập tay', () => {
  const formSource = readFileSync(
    new URL('../src/components/TechnicalConfigurationForm.tsx', import.meta.url),
    'utf8',
  );
  const editorSource = readFileSync(
    new URL('../src/components/ConsultationProfileEditDrawer.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(formSource, /<span>Phường \/ xã<\/span>/);
  assert.doesNotMatch(formSource, /<span>Tỉnh \/ thành phố<\/span>/);
  assert.doesNotMatch(formSource, /onChange=\{\(event\) => patch\(\{ installationWard:/);
  assert.doesNotMatch(formSource, /onChange=\{\(event\) => patch\(\{ installationProvince:/);
  assert.match(editorSource, /Khu vực lắp đặt/);
  assert.match(editorSource, /Tự động từ vị trí ghim/);
});
