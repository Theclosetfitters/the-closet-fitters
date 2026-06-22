import type { Metadata } from 'next';
import ConsultationLayout from '@/components/ConsultationLayout';
import ConsultationConfirmed from '@/components/ConsultationConfirmed';

export const metadata: Metadata = {
  title: 'Request Received',
};

export default function ConsultationConfirmedPage() {
  return (
    <ConsultationLayout
      photoSrc="/images/consultation-confirmed.jpg"
      photoAlt="A custom closet by The Closet Fitters"
    >
      <ConsultationConfirmed />
    </ConsultationLayout>
  );
}
