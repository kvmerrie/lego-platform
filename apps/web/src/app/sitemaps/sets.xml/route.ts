import {
  buildUrlSetXml,
  collectSetSitemapEntries,
  createXmlResponse,
} from '../../lib/sitemap-builder';

export async function GET(): Promise<Response> {
  return createXmlResponse(buildUrlSetXml(await collectSetSitemapEntries()));
}
