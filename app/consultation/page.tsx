import type { Metadata } from 'next';
import ConsultationLayout from '@/components/ConsultationLayout';
import ConsultationForm from '@/components/ConsultationForm';

export const metadata: Metadata = {
  title: 'Free Consultation',
  description: 'Schedule your free custom-closet design consultation with The Closet Fitters.',
};

export default function ConsultationPage() {
  return (
    <ConsultationLayout
      photoSrc="/images/consultation-hero.jpg"
      photoAlt="A custom closet by The Closet Fitters"
    >
      <h1 className="font-display text-4xl font-semibold leading-tight text-brand sm:text-5xl">
        Let&apos;s schedule your free design consultation.
      </h1>
      <div className="mt-8">
        <ConsultationForm flow="standalone" />
      </div>
    </ConsultationLayout>
  );
}
