export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string
          user_id: string
          original_filename: string
          auto_generated_name: string
          storage_path: string
          document_type: DocumentType
          category: string | null
          ocr_text: string | null
          metadata: Json
          thumbnail_url: string | null
          file_size: number
          mime_type: string
          folder_id: string | null
          created_at: string
          updated_at: string
          scanned_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          original_filename: string
          auto_generated_name: string
          storage_path: string
          document_type: DocumentType
          category?: string | null
          ocr_text?: string | null
          metadata?: Json
          thumbnail_url?: string | null
          file_size: number
          mime_type: string
          folder_id?: string | null
          created_at?: string
          updated_at?: string
          scanned_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          original_filename?: string
          auto_generated_name?: string
          storage_path?: string
          document_type?: DocumentType
          category?: string | null
          ocr_text?: string | null
          metadata?: Json
          thumbnail_url?: string | null
          file_size?: number
          mime_type?: string
          folder_id?: string | null
          created_at?: string
          updated_at?: string
          scanned_at?: string | null
        }
      }
      reminders: {
        Row: {
          id: string
          document_id: string
          user_id: string
          reminder_type: ReminderType
          reminder_date: string
          title: string
          description: string | null
          is_completed: boolean
          is_notified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_id: string
          user_id: string
          reminder_type: ReminderType
          reminder_date: string
          title: string
          description?: string | null
          is_completed?: boolean
          is_notified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          user_id?: string
          reminder_type?: ReminderType
          reminder_date?: string
          title?: string
          description?: string | null
          is_completed?: boolean
          is_notified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          biometric_enabled: boolean
          notification_enabled: boolean
          auto_backup_enabled: boolean
          theme: 'light' | 'dark' | 'auto'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          biometric_enabled?: boolean
          notification_enabled?: boolean
          auto_backup_enabled?: boolean
          theme?: 'light' | 'dark' | 'auto'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          biometric_enabled?: boolean
          notification_enabled?: boolean
          auto_backup_enabled?: boolean
          theme?: 'light' | 'dark' | 'auto'
          created_at?: string
          updated_at?: string
        }
      }
      folders: {
        Row: {
          id: string
          user_id: string
          name: string
          parent_id: string | null
          color: string
          icon: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          parent_id?: string | null
          color?: string
          icon?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          parent_id?: string | null
          color?: string
          icon?: string
          created_at?: string
          updated_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          created_at?: string
        }
      }
      document_tags: {
        Row: {
          document_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          document_id: string
          tag_id: string
          created_at?: string
        }
        Update: {
          document_id?: string
          tag_id?: string
          created_at?: string
        }
      }
      family_groups: {
        Row: {
          id: string
          name: string
          owner_id: string
          invite_code: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          invite_code?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          invite_code?: string
          created_at?: string
          updated_at?: string
        }
      }
      family_members: {
        Row: {
          id: string
          family_group_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          family_group_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          family_group_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
      }
      document_shares: {
        Row: {
          id: string
          document_id: string
          shared_by: string
          shared_with: string | null
          family_group_id: string | null
          permission: 'view' | 'edit'
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          shared_by: string
          shared_with?: string | null
          family_group_id?: string | null
          permission?: 'view' | 'edit'
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          shared_by?: string
          shared_with?: string | null
          family_group_id?: string | null
          permission?: 'view' | 'edit'
          created_at?: string
        }
      }
      folder_shares: {
        Row: {
          id: string
          folder_id: string
          shared_by: string
          shared_with: string | null
          family_group_id: string | null
          permission: 'view' | 'edit'
          created_at: string
        }
        Insert: {
          id?: string
          folder_id: string
          shared_by: string
          shared_with?: string | null
          family_group_id?: string | null
          permission?: 'view' | 'edit'
          created_at?: string
        }
        Update: {
          id?: string
          folder_id?: string
          shared_by?: string
          shared_with?: string | null
          family_group_id?: string | null
          permission?: 'view' | 'edit'
          created_at?: string
        }
      }
      email_imports: {
        Row: {
          id: string
          user_id: string
          document_id: string | null
          email_subject: string | null
          email_from: string | null
          email_date: string | null
          attachment_name: string
          import_source: 'manual' | 'imap' | 'webhook' | 'forward'
          processed: boolean
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          document_id?: string | null
          email_subject?: string | null
          email_from?: string | null
          email_date?: string | null
          attachment_name: string
          import_source?: 'manual' | 'imap' | 'webhook' | 'forward'
          processed?: boolean
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          document_id?: string | null
          email_subject?: string | null
          email_from?: string | null
          email_date?: string | null
          attachment_name?: string
          import_source?: 'manual' | 'imap' | 'webhook' | 'forward'
          processed?: boolean
          error_message?: string | null
          created_at?: string
        }
      }
      export_history: {
        Row: {
          id: string
          user_id: string
          export_type: 'pdf' | 'zip' | 'csv'
          document_ids: string[]
          file_name: string
          file_size: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          export_type: 'pdf' | 'zip' | 'csv'
          document_ids: string[]
          file_name: string
          file_size?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          export_type?: 'pdf' | 'zip' | 'csv'
          document_ids?: string[]
          file_name?: string
          file_size?: number | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_can_edit_document: {
        Args: { doc_id: string }
        Returns: boolean
      }
      get_folder_path: {
        Args: { folder_id: string }
        Returns: Array<{ id: string; name: string; depth: number }>
      }
    }
    Enums: {
      document_type: DocumentType
      reminder_type: ReminderType
    }
  }
}

export type DocumentType =
  | 'receipt'
  | 'warranty'
  | 'medical'
  | 'tax'
  | 'contract'
  | 'car_service'
  | 'insurance'
  | 'misc'

export type ReminderType =
  | 'warranty_expiration'
  | 'insurance_renewal'
  | 'tax_deadline'
  | 'lease_expiration'
  | 'medical_followup'
  | 'car_maintenance'
  | 'contract_renewal'
  | 'custom'

export type SharePermission = 'view' | 'edit'
export type FamilyRole = 'owner' | 'admin' | 'member'
export type ExportType = 'pdf' | 'zip' | 'csv'
export type ImportSource = 'manual' | 'imap' | 'webhook' | 'forward'

export interface Folder {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  color: string
  icon: string
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface FamilyGroup {
  id: string
  name: string
  owner_id: string
  invite_code: string
  created_at: string
  updated_at: string
}

export interface FamilyMember {
  id: string
  family_group_id: string
  user_id: string
  role: FamilyRole
  joined_at: string
}

export interface DocumentShare {
  id: string
  document_id: string
  shared_by: string
  shared_with: string | null
  family_group_id: string | null
  permission: SharePermission
  created_at: string
}

export interface DocumentMetadata {
  // Common fields
  date?: string
  amount?: number
  currency?: string
  vendor?: string
  category?: string
  tags?: string[]

  // Receipt specific
  items?: Array<{
    name: string
    quantity?: number
    price?: number
  }>

  // Warranty specific
  product_name?: string
  serial_number?: string
  purchase_date?: string
  expiration_date?: string
  warranty_period?: string

  // Medical specific
  provider?: string
  patient_name?: string
  diagnosis?: string
  prescription?: string

  // Tax specific
  tax_year?: string
  form_type?: string

  // Contract specific
  contract_party?: string
  start_date?: string
  end_date?: string
  renewal_terms?: string

  // Car service specific
  vehicle?: string
  mileage?: number
  service_type?: string
  next_service_date?: string

  // Insurance specific
  policy_number?: string
  coverage_type?: string
  premium?: number
  renewal_date?: string

  // Custom fields
  [key: string]: any
}
