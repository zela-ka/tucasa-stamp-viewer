import skyOcean from '@/assets/backgrounds/sky-ocean.jpg';

/** Shared sky + ocean backdrop used on every page. */
export const APP_BG_IMAGE = skyOcean;

export const appBgStyle: React.CSSProperties = {
  backgroundImage:
    'radial-gradient(1200px 700px at 10% -10%, rgba(23,58,130,0.45), transparent 60%),' +
    'radial-gradient(900px 700px at 50% 120%, rgba(12,40,95,0.55), transparent 65%),' +
    'linear-gradient(180deg, rgba(10,32,78,0.42) 0%, rgba(12,40,95,0.38) 50%, rgba(8,26,66,0.55) 100%),' +
    `url(${skyOcean})`,
  backgroundSize: 'cover, cover, cover, cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundAttachment: 'fixed',
};
