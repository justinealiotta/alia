import dynamic from 'next/dynamic';

// Client-only: the screen uses the DOM, canvas, localStorage and the TipTap
// composer, so it is rendered without SSR (faithful SPA behaviour).
const Landing = dynamic(() => import('../screens/Landing'), { ssr: false });

export default function Page() {
  return <Landing />;
}
