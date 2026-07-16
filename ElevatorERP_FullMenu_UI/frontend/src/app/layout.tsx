import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import AppFrame from '@/components/AppFrame';
import AppProviders from '@/components/AppProviders';
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
          <AppProviders>
            <AppFrame>{children}</AppFrame>
          </AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
