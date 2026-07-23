'use client';

import dynamic from 'next/dynamic';

const ReferralTool = dynamic(() => import('@/screens/ReferralTool'), { ssr: false });

export default function Page() {
  return <ReferralTool />;
}
