'use client';

import dynamic from 'next/dynamic';

const ReferralFlowSeed = dynamic(() => import('@/screens/ReferralFlowSeed'), { ssr: false });

export default function Page() {
  return <ReferralFlowSeed />;
}
