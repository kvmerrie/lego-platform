export const bricksetGalleryAttributionText =
  'Image(s) courtesy of Brickset.com';

export type BricksetGalleryMetadataPolicy =
  | 'metadata_only_pending_rights_review'
  | 'public_rendering_approved'
  | 'render_publicly_with_attribution';

export type BricksetGalleryImageType =
  | 'additional'
  | 'minifig'
  | 'primary'
  | 'unknown';
export type BricksetGalleryRenderMode = 'attribution_required' | 'disabled';

export interface BricksetGalleryImagePolicyInput {
  attributionRequired?: boolean;
  imageRightsPolicy?: BricksetGalleryMetadataPolicy;
  renderMode?: BricksetGalleryRenderMode;
  sourceField?: string;
  type?: BricksetGalleryImageType;
}

export interface BricksetGalleryImagePolicyDecision {
  attributionText?: string;
  canRenderPublicly: boolean;
  reason:
    | 'additional_image_requires_attribution'
    | 'bricklink_or_minifig_image_blocked'
    | 'metadata_policy_pending_rights_review'
    | 'primary_official_image_fair_play_required'
    | 'render_mode_disabled'
    | 'render_mode_requires_attributed_additional_image'
    | 'render_publicly_with_attribution'
    | 'unsupported_image_source';
}

function isApprovedBricksetGalleryPolicy(
  imageRightsPolicy: BricksetGalleryMetadataPolicy,
): boolean {
  return (
    imageRightsPolicy === 'render_publicly_with_attribution' ||
    imageRightsPolicy === 'public_rendering_approved'
  );
}

function isBrickLinkOrMinifigImage({
  sourceField,
  type,
}: Pick<BricksetGalleryImagePolicyInput, 'sourceField' | 'type'>): boolean {
  const normalizedSource = (sourceField ?? '').toLowerCase();

  return (
    type === 'minifig' ||
    normalizedSource.includes('bricklink') ||
    normalizedSource.includes('minifig')
  );
}

export function resolveBricksetGalleryImagePolicy({
  attributionRequired,
  imageRightsPolicy = 'metadata_only_pending_rights_review',
  renderMode = 'disabled',
  sourceField,
  type,
}: BricksetGalleryImagePolicyInput): BricksetGalleryImagePolicyDecision {
  if (renderMode === 'disabled') {
    return {
      attributionText: attributionRequired
        ? bricksetGalleryAttributionText
        : undefined,
      canRenderPublicly: false,
      reason: 'render_mode_disabled',
    };
  }

  if (isBrickLinkOrMinifigImage({ sourceField, type })) {
    return {
      canRenderPublicly: false,
      reason: 'bricklink_or_minifig_image_blocked',
    };
  }

  if (type === 'primary' || sourceField === 'image.imageURL') {
    return {
      canRenderPublicly: false,
      reason: 'primary_official_image_fair_play_required',
    };
  }

  const isAdditionalSetImage =
    type === 'additional' || sourceField === 'additionalImages';

  if (
    renderMode === 'attribution_required' &&
    attributionRequired === true &&
    isAdditionalSetImage &&
    isApprovedBricksetGalleryPolicy(imageRightsPolicy)
  ) {
    return {
      attributionText: bricksetGalleryAttributionText,
      canRenderPublicly: true,
      reason:
        imageRightsPolicy === 'render_publicly_with_attribution'
          ? 'render_publicly_with_attribution'
          : 'additional_image_requires_attribution',
    };
  }

  if (imageRightsPolicy === 'metadata_only_pending_rights_review') {
    return {
      attributionText: attributionRequired
        ? bricksetGalleryAttributionText
        : undefined,
      canRenderPublicly: false,
      reason: 'metadata_policy_pending_rights_review',
    };
  }

  if (!isAdditionalSetImage) {
    return {
      canRenderPublicly: false,
      reason: 'unsupported_image_source',
    };
  }

  return {
    canRenderPublicly: false,
    reason: 'render_mode_requires_attributed_additional_image',
  };
}
