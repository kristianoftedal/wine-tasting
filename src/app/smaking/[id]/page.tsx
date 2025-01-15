import { TastingWizard } from '@/app/components/tastingWizard';

export default async function Tasting(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wine = await getWine(id);

  return (
    <TastingWizard wine={wine} />
  );
}

const getWine = async (id: string) => {
  const res = await fetch(`${process.env.API_URL}/api/wine/${id}`);
  const data = await res.json();
  const model = data;
  return model;
};

const getBaseUrl = () => {
  if (process.env.NODE_ENV ===  "production") {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  return 'http://localhost:3000';
};
