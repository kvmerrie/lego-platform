import {
  buildSitemapIndexEntries,
  buildSitemapIndexXml,
  createXmlResponse,
} from '../lib/sitemap-builder';

export function GET(): Response {
  return createXmlResponse(buildSitemapIndexXml(buildSitemapIndexEntries()));
}
