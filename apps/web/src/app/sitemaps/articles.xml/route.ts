import {
  buildUrlSetXml,
  collectArticleSitemapEntries,
  createXmlResponse,
} from '../../lib/sitemap-builder';

export async function GET(): Promise<Response> {
  return createXmlResponse(
    buildUrlSetXml(await collectArticleSitemapEntries()),
  );
}
