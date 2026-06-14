import dynamic from 'next/dynamic';
import { PRIVACY_HTML } from '../screens/legalContent';

const Legal = dynamic(() => import('../screens/Legal'), { ssr: false });

export default function Page() {
  return <Legal html={PRIVACY_HTML} label="Privacy" id="privacy" backHref="/" />;
}
