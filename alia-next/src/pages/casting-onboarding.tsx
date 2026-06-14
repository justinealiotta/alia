import dynamic from 'next/dynamic';

const CastingOnboarding = dynamic(() => import('../screens/CastingOnboarding'), { ssr: false });

export default function Page() {
  return <CastingOnboarding />;
}
