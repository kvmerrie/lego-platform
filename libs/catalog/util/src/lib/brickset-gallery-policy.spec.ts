import { describe, expect, test } from 'vitest';
import {
  bricksetGalleryAttributionText,
  resolveBricksetGalleryImagePolicy,
} from './brickset-gallery-policy';

describe('resolveBricksetGalleryImagePolicy', () => {
  test('blocks Brickset images by default', () => {
    expect(
      resolveBricksetGalleryImagePolicy({
        attributionRequired: true,
        imageRightsPolicy: 'render_publicly_with_attribution',
        sourceField: 'additionalImages',
        type: 'additional',
      }),
    ).toEqual({
      attributionText: bricksetGalleryAttributionText,
      canRenderPublicly: false,
      reason: 'render_mode_disabled',
    });
  });

  test('allows attributed additional Brickset images only in attribution mode', () => {
    expect(
      resolveBricksetGalleryImagePolicy({
        attributionRequired: true,
        imageRightsPolicy: 'render_publicly_with_attribution',
        renderMode: 'attribution_required',
        sourceField: 'additionalImages',
        type: 'additional',
      }),
    ).toEqual({
      attributionText: bricksetGalleryAttributionText,
      canRenderPublicly: true,
      reason: 'render_publicly_with_attribution',
    });
  });

  test('keeps pending-rights-review images out of public galleries', () => {
    expect(
      resolveBricksetGalleryImagePolicy({
        attributionRequired: true,
        imageRightsPolicy: 'metadata_only_pending_rights_review',
        renderMode: 'attribution_required',
        sourceField: 'additionalImages',
        type: 'additional',
      }),
    ).toEqual({
      attributionText: bricksetGalleryAttributionText,
      canRenderPublicly: false,
      reason: 'metadata_policy_pending_rights_review',
    });
  });

  test('rejects additional Brickset images without explicit attribution', () => {
    expect(
      resolveBricksetGalleryImagePolicy({
        imageRightsPolicy: 'public_rendering_approved',
        renderMode: 'attribution_required',
        sourceField: 'additionalImages',
        type: 'additional',
      }),
    ).toEqual({
      canRenderPublicly: false,
      reason: 'render_mode_requires_attributed_additional_image',
    });
  });

  test('keeps primary Brickset images out of public galleries', () => {
    expect(
      resolveBricksetGalleryImagePolicy({
        attributionRequired: false,
        imageRightsPolicy: 'public_rendering_approved',
        renderMode: 'attribution_required',
        sourceField: 'image.imageURL',
        type: 'primary',
      }),
    ).toEqual({
      canRenderPublicly: false,
      reason: 'primary_official_image_fair_play_required',
    });
  });

  test('blocks BrickLink and minifig-derived images', () => {
    expect(
      resolveBricksetGalleryImagePolicy({
        attributionRequired: true,
        imageRightsPolicy: 'render_publicly_with_attribution',
        renderMode: 'attribution_required',
        sourceField: 'brickLinkMinifigImage',
        type: 'minifig',
      }),
    ).toEqual({
      canRenderPublicly: false,
      reason: 'bricklink_or_minifig_image_blocked',
    });
  });

  test('blocks unknown image sources', () => {
    expect(
      resolveBricksetGalleryImagePolicy({
        attributionRequired: true,
        imageRightsPolicy: 'render_publicly_with_attribution',
        renderMode: 'attribution_required',
        sourceField: 'unknownGalleryImage',
        type: 'unknown',
      }),
    ).toEqual({
      canRenderPublicly: false,
      reason: 'unsupported_image_source',
    });
  });
});
