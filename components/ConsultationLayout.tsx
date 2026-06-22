import SiteFooter from '@/components/SiteFooter';
import ConsultationPhoto from '@/components/ConsultationPhoto';

// Two-column consultation layout: form (55%) on the left, photo (45%) on the
// right; on mobile the photo stacks above the form. Cream page background; the
// global nav + the shared footer wrap it.
export default function ConsultationLayout({
  children,
  photoSrc,
  photoAlt,
}: {
  children: React.ReactNode;
  photoSrc: string;
  photoAlt: string;
}) {
  return (
    <>
      <main className="bg-cream">
        <div className="mx-auto grid max-w-6xl items-stretch md:grid-cols-[55fr_45fr]">
          {/* Photo — first in DOM so it sits above the form on mobile, right on desktop */}
          <div className="relative order-1 h-64 w-full sm:h-80 md:order-2 md:h-auto md:min-h-[640px]">
            <ConsultationPhoto src={photoSrc} alt={photoAlt} />
          </div>
          {/* Form column */}
          <div className="order-2 px-6 py-12 md:order-1 md:px-12 md:py-16">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
