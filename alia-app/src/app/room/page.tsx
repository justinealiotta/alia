'use client';

import dynamic from 'next/dynamic';

const RoomSmart = dynamic(() => import('@/screens/RoomSmart'), { ssr: false });

export default function Page() {
  return <RoomSmart />;
}
