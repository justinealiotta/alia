import dynamic from 'next/dynamic';

const Room = dynamic(() => import('../Room'), { ssr: false });

export default function Page() {
  return <Room />;
}
