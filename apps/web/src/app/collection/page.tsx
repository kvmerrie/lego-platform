import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import { redirect } from 'next/navigation';

export default function CollectionPage() {
  redirect(buildWebPath(webPathnames.collection));
}
