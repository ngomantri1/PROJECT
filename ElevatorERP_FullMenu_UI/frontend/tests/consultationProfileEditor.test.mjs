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
  assert.doesNotMatch(summarySource, /Nhân bản cấu hình|Xóa thang máy/);
  assert.doesNotMatch(summarySource, />Thêm thang<\/Button>/);
  assert.match(summarySource, /onClick=\{openTechnicalWorkspace\}>Mở cấu hình chi tiết<\/Button>/);
  assert.match(technicalDrawerSource, /label: 'Nhân bản cấu hình'/);
  assert.match(technicalDrawerSource, /label: 'Xóa thang máy'/);
  assert.match(technicalDrawerSource, /overlayClassName='technical-action-dropdown'/);
  assert.match(technicalDrawerSource, /overlayStyle=\{\{ zIndex: 1700 \}\}/);
  assert.match(technicalDrawerSource, /getPopupContainer=\{\(\) => document\.body\}/);
});

test('xóa thang máy mở hộp xác nhận phía trên drawer và loại đúng thang được chọn', () => {
  const editorSource = readFileSync(
    new URL('../src/components/ConsultationProfileEditDrawer.tsx', import.meta.url),
    'utf8',
  );
  const globalStyleSource = readFileSync(
    new URL('../src/app/globals.css', import.meta.url),
    'utf8',
  );

  assert.match(editorSource, /open=\{deleteCandidateIndex !== undefined\}/);
  assert.match(editorSource, /title='Xóa thang máy\?'/);
  assert.match(editorSource, /okText='Xóa thang máy'/);
  assert.match(editorSource, /zIndex=\{10000\}/);
  assert.match(editorSource, /rootClassName='technical-delete-confirm-root'/);
  assert.match(editorSource, /className='technical-delete-confirm-modal'/);
  assert.match(editorSource, /width=\{360\}/);
  assert.match(editorSource, /getContainer=\{\(\) => document\.body\}/);
  assert.match(editorSource, /configurations\.filter\(\(_, currentIndex\) => currentIndex !== deleteCandidateIndex\)/);
  assert.doesNotMatch(editorSource, /label: 'Xóa cấu hình'/);
  assert.match(globalStyleSource, /ant-modal-root:not\(\.technical-delete-confirm-root\)/);
  assert.match(globalStyleSource, /ant-modal\.technical-delete-confirm-modal:not\(\.ant-modal-confirm\)\{top:auto!important;width:min\(360px,calc\(100vw - 32px\)\)/);
  assert.match(globalStyleSource, /technical-delete-confirm-modal:not\(\.ant-modal-confirm\) \.ant-modal-content\{display:block!important;height:auto!important/);
  assert.match(globalStyleSource, /technical-delete-confirm-modal:not\(\.ant-modal-confirm\) \.ant-modal-body\{display:block!important;flex:none!important/);
});

test('footer Drawer và Modal căn nhóm thao tác về bên phải', () => {
  const globalStyleSource = readFileSync(
    new URL('../src/app/globals.css', import.meta.url),
    'utf8',
  );

  assert.match(globalStyleSource, /\.ant-drawer-footer\{text-align:end\}/);
  assert.match(globalStyleSource, /\.ant-drawer-footer>\.ant-space\{display:flex!important;justify-content:flex-end;width:100%\}/);
  assert.match(globalStyleSource, /\.ant-modal-footer\{text-align:end\}/);
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
  assert.match(editorSource, /<span>Khu vực:<\/span>/);
  assert.match(editorSource, /Tự động từ vị trí ghim/);
});

test('khối vị trí ghim dùng bố cục compact và tooltip cho nội dung dài', () => {
  const editorSource = readFileSync(
    new URL('../src/components/ConsultationProfileEditDrawer.tsx', import.meta.url),
    'utf8',
  );
  const detailSource = readFileSync(
    new URL('../src/app/consultation-profiles/[id]/configurations/[configurationId]/page.tsx', import.meta.url),
    'utf8',
  );
  const cssSource = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

  for (const source of [editorSource, detailSource]) {
    assert.match(source, /technical-location-panel compact/);
    assert.match(source, /<Tooltip title=\{pinnedLocationText\}>/);
    assert.match(source, /<Tooltip title=\{installationAreaText\}>/);
    assert.doesNotMatch(source, /Ghim tọa độ riêng cho thang này để kỹ thuật mở bản đồ/);
  }
  assert.match(cssSource, /\.technical-location-panel\{[^}]*padding:10px 12px/);
  assert.match(cssSource, /\.technical-location-panel \.location-pin-summary>span\{[^}]*text-overflow:ellipsis;white-space:nowrap/);
});

test('popup ghim vị trí dùng lại đầy đủ chức năng của màn hình đăng ký tư vấn', () => {
  const pickerSource = readFileSync(
    new URL('../src/components/DeploymentLocationPickerModal.tsx', import.meta.url),
    'utf8',
  );
  const editorSource = readFileSync(
    new URL('../src/components/ConsultationProfileEditDrawer.tsx', import.meta.url),
    'utf8',
  );
  const detailSource = readFileSync(
    new URL('../src/app/consultation-profiles/[id]/configurations/[configurationId]/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(pickerSource, /Chọn vị trí và ghim bản đồ/);
  assert.match(pickerSource, /\/geo\/search/);
  assert.match(pickerSource, /\/geo\/resolve-link/);
  assert.match(pickerSource, /Sửa tọa độ/);
  assert.match(pickerSource, /Lấy vị trí hiện tại/);
  assert.match(pickerSource, /Xóa pin/);
  assert.match(pickerSource, /Xác nhận ghim vị trí/);
  assert.match(pickerSource, /onPick=\{\(latitude, longitude\) => void pickLocation/);
  assert.match(editorSource, /<DeploymentLocationPickerModal/);
  assert.match(detailSource, /<DeploymentLocationPickerModal/);
  assert.doesNotMatch(editorSource, /title='Ghim vị trí lắp đặt'/);
  assert.doesNotMatch(detailSource, /title='Ghim vị trí lắp đặt'/);
});

test('sửa trực tiếp một thang chỉ lưu đúng cấu hình được chọn', () => {
  const editorSource = readFileSync(
    new URL('../src/components/ConsultationProfileEditDrawer.tsx', import.meta.url),
    'utf8',
  );

  assert.match(editorSource, /mode\?: 'FULL_PROFILE' \| 'SINGLE_CONFIGURATION'/);
  assert.match(editorSource, /const isSingleConfiguration = mode === 'SINGLE_CONFIGURATION'/);
  assert.match(editorSource, /configurations\.findIndex\(\(item\) => item\.id === initialConfigurationId\)/);
  assert.match(editorSource, /updated\.id !== initialConfigurationId/);
  assert.match(editorSource, /\/technical-configurations\/\$\{configurationId\}/);
  assert.match(editorSource, /!isSingleConfiguration && <Button className='technical-add-tab'/);
  assert.match(editorSource, /!isSingleConfiguration && editingIndex !== undefined && <Dropdown/);
});

test('nút dùng địa chỉ liên hệ hiển thị trước nội dung địa chỉ bằng tooltip', () => {
  const formSource = readFileSync(
    new URL('../src/components/TechnicalConfigurationForm.tsx', import.meta.url),
    'utf8',
  );

  assert.match(formSource, /overlayClassName='contact-address-tooltip'/);
  assert.match(formSource, /Địa chỉ liên hệ khách hàng/);
  assert.match(formSource, /<strong>\{normalizedContactAddress\}<\/strong>/);
  assert.match(formSource, /Bấm nút để dùng địa chỉ này cho công trình/);
  assert.match(formSource, /disabled=\{disabled \|\| !normalizedContactAddress\}/);
  assert.match(formSource, />Dùng địa chỉ liên hệ<\/Button>/);
});
