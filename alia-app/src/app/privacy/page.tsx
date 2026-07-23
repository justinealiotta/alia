'use client';

import dynamic from 'next/dynamic';
import { PRIVACY_HTML } from '@/legalContent';

const Legal = dynamic(() => import('@/screens/Legal'), { ssr: false });

export default function Page() {
  return <Legal html={PRIVACY_HTML} id="privacy" />;
}
