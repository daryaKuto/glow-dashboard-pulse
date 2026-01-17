/**
 * Service for uploading and managing custom sound files for targets
 * Handles file uploads to Supabase Storage with validation
 */

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/shared/hooks/use-auth';

const STORAGE_BUCKET = 'target-sounds';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];

export interface SoundUploadResult {
  url: string;
  path: string;
  error?: string;
}

/**
 * Upload a sound file for a specific target
 * @param targetId - The target device ID
 * @param file - The audio file to upload
 * @returns Public URL of the uploaded file
 */
export async function uploadTargetSound(
  targetId: string,
  file: File
): Promise<SoundUploadResult> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to upload sounds');
  }

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(
      `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const fileExtension = file.name.split('.').pop() || 'mp3';
  const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = `${user.id}/${targetId}/${fileName}`;

  try {
    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error('Error uploading sound file:', error);
    return {
      url: '',
      path: '',
      error: error instanceof Error ? error.message : 'Failed to upload sound file',
    };
  }
}

/**
 * Delete a sound file from storage
 * @param filePath - The storage path of the file to delete
 */
export async function deleteTargetSound(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete sound file: ${error.message}`);
  }
}

/**
 * Get public URL for a sound file
 * @param filePath - The storage path of the file
 * @returns Public URL
 */
export function getSoundUrl(filePath: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

/**
 * Validate audio file before upload
 * @param file - File to validate
 * @returns Validation result with error message if invalid
 */
export function validateSoundFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: MP3, WAV, OGG`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    };
  }

  return { valid: true };
}

