import { redirect } from 'next/navigation';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';

export default function DiscoverRedirectPage() {
  redirect(buildWebPath(webPathnames.deals));
}
