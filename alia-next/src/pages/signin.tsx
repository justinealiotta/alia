import dynamic from 'next/dynamic';

const Otp = dynamic(() => import('../screens/Otp'), { ssr: false });

export default function Page() {
  return <Otp />;
}
