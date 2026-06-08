import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  value: string | null;
  onChange: (path: string | null) => void;
  /** If provided, used as filename prefix for grouping */
  prefix?: string;
}

export function PhotoUpload({ value, onChange, prefix = 'photo' }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Resolve signed URL for preview
  if (value && !previewUrl && !uploading) {
    supabase.storage.from('attachments').createSignedUrl(value, 60 * 60).then(({ data }) => {
      if (data?.signedUrl) setPreviewUrl(data.signedUrl);
    });
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Not signed in');
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${uid}/${prefix}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('attachments').upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from('attachments').createSignedUrl(path, 60 * 60);
      setPreviewUrl(signed?.signedUrl ?? null);
      onChange(path);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    onChange(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {value && previewUrl ? (
        <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={clear}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImagePlus className="h-4 w-4 mr-2" />}
          Add photo
        </Button>
      )}
    </div>
  );
}

/** Hook to resolve a stored path to a signed URL */
export function usePhotoUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  if (path && !url) {
    supabase.storage.from('attachments').createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }
  return url;
}
