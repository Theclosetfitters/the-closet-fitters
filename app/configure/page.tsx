import type { Metadata } from 'next';
import { catalog } from '@/lib/catalog';
import Configurator from '@/components/Configurator';

export const metadata: Metadata = {
  title: 'Configure your closet',
  description: 'Design a custom closet and see a live 3D preview and price.',
};

export default function ConfigurePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6">
      <header className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Design your closet
        </h1>
        <p className="mt-1 text-sm text-muted">
          Choose your material and hardware, then build it. The 3D preview and
          price update as you go.
        </p>
      </header>
      <Configurator catalog={catalog} />
    </main>
  );
}
