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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
