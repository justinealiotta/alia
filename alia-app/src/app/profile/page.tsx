'use client';

import dynamic from 'next/dynamic';

const Profile = dynamic(() => import('@/screens/Profile'), { ssr: false });

export default function Page() {
  return <Profile />;
}
