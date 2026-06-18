// The Closet Fitters wordmark, recreated typographically from the brand logo:
// a script "The" sitting above the serif "Closet Fitters".
export default function Logo({
  size = 'sm',
  tone = 'dark',
}: {
  size?: 'sm' | 'lg';
  tone?: 'dark' | 'light';
}) {
  const serif = size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-[20px]';
  const script = size === 'lg' ? 'text-3xl ml-1' : 'text-[15px] ml-[3px]';
  const serifColor = tone === 'light' ? 'text-cream' : 'text-ink';
  const scriptColor = tone === 'light' ? 'text-sand' : 'text-walnut';

  return (
    <span className="inline-flex flex-col leading-none">
      <span className={`font-script leading-none ${script} ${scriptColor} mb-[-3px]`}>
        The
      </span>
      <span
        className={`font-display font-medium leading-none tracking-tight ${serif} ${serifColor}`}
      >
        Closet Fitters
      </span>
    </span>
  );
}
