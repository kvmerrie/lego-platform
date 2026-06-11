// eslint-disable-next-line @nx/enforce-module-boundaries -- This SSR wrapper is consumed by Next server components for public review payloads.
export {
  getCatalogSetReviewsPublicPayload,
  type CatalogSetReviewAccessError,
} from '@lego-platform/reviews/data-access-server';
