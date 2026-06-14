import dynamic from 'next/dynamic';

const P2POnboarding = dynamic(() => import('../screens/P2POnboarding'), { ssr: false });

export default function Page() {
  return <P2POnboarding />;
}
