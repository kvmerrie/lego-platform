import { draftMode } from 'next/headers';

export async function getEditorialQueryMode(): Promise<'delivery' | 'preview'> {
  const draftModeState = await draftMode();

  return draftModeState.isEnabled ? 'preview' : 'delivery';
}
