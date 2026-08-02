import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { useAuth } from './useAuth'
import type { ProjectDocument, PublicProfile } from '../types'

const BUCKET = 'project-roadmaps'
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}

/**
 * Per-project "Detailed Roadmap" PDFs: list, upload, delete, and open (via a
 * short-lived signed URL). Access is enforced by RLS + Storage policies — the
 * hook only reflects what the caller is allowed to do.
 */
export function useProjectDocuments(projectId: string | undefined) {
  const toast = useToast()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [uploaders, setUploaders] = useState<Record<string, PublicProfile>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const loadAll = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) throw error
      const docs = (data as ProjectDocument[]) ?? []
      setDocuments(docs)

      const ids = Array.from(
        new Set(
          docs
            .map((d) => d.uploaded_by)
            .filter((id): id is string => Boolean(id)),
        ),
      )
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('public_profiles')
          .select('id, full_name, moodle_username')
          .in('id', ids)
        const map: Record<string, PublicProfile> = {}
        for (const p of (profs as PublicProfile[]) ?? []) map[p.id] = p
        setUploaders(map)
      } else {
        setUploaders({})
      }
    } catch (e) {
      toast.error(`Could not load roadmaps: ${msg(e)}`)
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  /** Validate + upload a PDF, then record its metadata. */
  const upload = useCallback(
    async (file: File): Promise<boolean> => {
      if (!projectId || !userId) {
        toast.error('You must be signed in to upload.')
        return false
      }
      const isPdf =
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        toast.error('Only PDF files are allowed.')
        return false
      }
      if (file.size > MAX_BYTES) {
        toast.error('That PDF is larger than 20 MB.')
        return false
      }

      setUploading(true)
      const path = `${projectId}/${crypto.randomUUID()}.pdf`
      try {
        const up = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: 'application/pdf',
          upsert: false,
        })
        if (up.error) throw up.error

        const { data, error } = await supabase
          .from('project_documents')
          .insert({
            project_id: projectId,
            storage_path: path,
            file_name: file.name,
            file_size: file.size,
            uploaded_by: userId,
          })
          .select()
          .single()
        if (error) {
          // Roll back the orphaned object if the metadata insert fails.
          await supabase.storage.from(BUCKET).remove([path])
          throw error
        }
        setDocuments((prev) => [data as ProjectDocument, ...prev])
        toast.success('Roadmap uploaded.')
        return true
      } catch (e) {
        toast.error(`Could not upload: ${msg(e)}`)
        return false
      } finally {
        setUploading(false)
      }
    },
    [projectId, userId, toast],
  )

  /** Delete a roadmap (storage object first, then its metadata row). */
  const remove = useCallback(
    async (doc: ProjectDocument) => {
      const snapshot = documents
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      try {
        const del = await supabase.storage
          .from(BUCKET)
          .remove([doc.storage_path])
        if (del.error) throw del.error
        const { error } = await supabase
          .from('project_documents')
          .delete()
          .eq('id', doc.id)
        if (error) throw error
      } catch (e) {
        setDocuments(snapshot)
        toast.error(`Could not delete: ${msg(e)}`)
      }
    },
    [documents, toast],
  )

  /** Open a roadmap in a new tab via a short-lived signed URL. */
  const open = useCallback(
    async (doc: ProjectDocument) => {
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(doc.storage_path, 60 * 60)
        if (error) throw error
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
      } catch (e) {
        toast.error(`Could not open the PDF: ${msg(e)}`)
      }
    },
    [toast],
  )

  return {
    documents,
    uploaders,
    loading,
    uploading,
    reload: loadAll,
    upload,
    remove,
    open,
  }
}

export type UseProjectDocuments = ReturnType<typeof useProjectDocuments>
