import dynamic from 'next/dynamic';

const Application = dynamic(() => import('../screens/Application'), { ssr: false });

export default function Page() {
  return <Application />;
}
