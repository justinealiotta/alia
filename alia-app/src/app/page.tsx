'use client';

import dynamic from 'next/dynamic';

const Landing = dynamic(() => import('@/screens/Landing'), { ssr: false });

export default function Page() {
  return <Landing />;
}
