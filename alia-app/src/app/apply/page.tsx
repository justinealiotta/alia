'use client';

import dynamic from 'next/dynamic';

const ApplyFlow = dynamic(() => import('@/screens/ApplyFlow'), { ssr: false });

export default function Page() {
  return <ApplyFlow />;
}
