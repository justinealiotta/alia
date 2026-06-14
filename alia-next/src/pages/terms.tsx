import dynamic from 'next/dynamic';
import { TERMS_HTML } from '../screens/legalContent';

const Legal = dynamic(() => import('../screens/Legal'), { ssr: false });

export default function Page() {
  return <Legal html={TERMS_HTML} label="Terms" id="terms" backHref="/" />;
}
