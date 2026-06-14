import dynamic from 'next/dynamic';

const P2PReferral = dynamic(() => import('../screens/P2PReferral'), { ssr: false });

export default function Page() {
  return <P2PReferral />;
}
