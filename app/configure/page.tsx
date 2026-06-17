import type { Metadata } from 'next';
import { catalog } from '@/lib/catalog';
import Configurator from '@/components/Configurator';

export const metadata: Metadata = {
  title: 'Configure your closet',
  description: 'Design a custom closet and see a live 3D preview and price.',
};

export default function ConfigurePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Design your closet
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pick a type, set the dimensions, and add components. The preview and
          price update as you go.
        </p>
      </header>
      <Configurator catalog={catalog} />
    </main>
  );
}
