'use client';

import dynamic from 'next/dynamic';

const CastingFlowSeed = dynamic(() => import('@/screens/CastingFlowSeed'), { ssr: false });

export default function Page() {
  return <CastingFlowSeed />;
}
