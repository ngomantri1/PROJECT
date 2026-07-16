import type { Metadata } from 'next';
import { App as AntdApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import './globals.css';

export const metadata: Metadata = {
  title: 'Thang máy Miền Trung ERP',
  description: 'Hệ thống ERP nội bộ quản lý vòng đời thang máy',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='vi'>
      <body>
        <AntdRegistry>
          <ConfigProvider
            locale={viVN}
            theme={{
              token: {
                colorPrimary: '#1677ff',
                colorInfo: '#1677ff',
                colorSuccess: '#16a34a',
                colorWarning: '#f59e0b',
                colorError: '#ef4444',
                colorText: '#172033',
                colorTextSecondary: '#667085',
                colorBgLayout: '#f3f6fa',
                borderRadius: 10,
                borderRadiusLG: 14,
                fontFamily:
                  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              },
              components: {
                Button: { controlHeight: 38, borderRadius: 9, fontWeight: 600 },
                Card: { headerFontSize: 16, paddingLG: 20 },
                Table: { headerBg: '#f8fafc', headerColor: '#475467' },
                Menu: { itemBorderRadius: 9, itemMarginInline: 10 },
                Input: { controlHeight: 38 },
                Select: { controlHeight: 38 },
              },
            }}
          >
            <AntdApp>{children}</AntdApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
