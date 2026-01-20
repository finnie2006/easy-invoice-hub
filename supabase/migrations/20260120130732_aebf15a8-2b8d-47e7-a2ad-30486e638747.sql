-- Add attachment_url column to invoices table for external invoice PDFs
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Create storage bucket for invoice attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-attachments', 'invoice-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for invoice attachments bucket
CREATE POLICY "Users can upload their own invoice attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoice-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own invoice attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoice-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own invoice attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoice-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);