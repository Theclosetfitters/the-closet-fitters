import type { Metadata } from 'next';
import { catalog } from '@/lib/catalog';
import Configurator from '@/components/Configurator';

export const metadata: Metadata = {
  title: 'Configure your closet',
  description: 'Design a custom closet and see a live 3D preview and price.',
};

export default async function ConfigurePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const { edit } = await searchParams;
  const editId = typeof edit === 'string' ? edit : undefined;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6">
      <header className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {editId ? 'Edit your closet' : 'Design your closet'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Choose your Layout, Material and Hardware. The 3D preview and price
          update as you go.
        </p>
      </header>
      <Configurator catalog={catalog} editId={editId} />
    </main>
  );
}
