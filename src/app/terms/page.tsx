'use client';

import dynamic from 'next/dynamic';
import { TERMS_HTML } from '@/legalContent';

const Legal = dynamic(() => import('@/screens/Legal'), { ssr: false });

export default function Page() {
  return <Legal html={TERMS_HTML} id="terms" />;
}
