import {
  buildSitemapIndexXml,
  collectSitemapIndexEntries,
  createXmlResponse,
} from '../lib/sitemap-builder';

export async function GET(): Promise<Response> {
  return createXmlResponse(
    buildSitemapIndexXml(await collectSitemapIndexEntries()),
  );
}
