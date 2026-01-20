export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          all_day: boolean | null
          created_at: string
          description: string | null
          end_time: string
          external_feed_id: string | null
          external_id: string | null
          id: string
          label_id: string | null
          location: string | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          created_at?: string
          description?: string | null
          end_time: string
          external_feed_id?: string | null
          external_id?: string | null
          id?: string
          label_id?: string | null
          location?: string | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          created_at?: string
          description?: string | null
          end_time?: string
          external_feed_id?: string | null
          external_id?: string | null
          id?: string
          label_id?: string | null
          location?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_external_feed_id_fkey"
            columns: ["external_feed_id"]
            isOneToOne: false
            referencedRelation: "external_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          btw_number: string | null
          city: string | null
          company_name: string
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_saved: boolean | null
          kvk_number: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          btw_number?: string | null
          city?: string | null
          company_name: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_saved?: boolean | null
          kvk_number?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          btw_number?: string | null
          city?: string | null
          company_name?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_saved?: boolean | null
          kvk_number?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_excl_btw: number | null
          amount_incl_btw: number
          btw_amount: number | null
          btw_percentage: number | null
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          notes: string | null
          receipt_url: string | null
          updated_at: string
          user_id: string
          vendor_name: string
        }
        Insert: {
          amount_excl_btw?: number | null
          amount_incl_btw: number
          btw_amount?: number | null
          btw_percentage?: number | null
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          updated_at?: string
          user_id: string
          vendor_name: string
        }
        Update: {
          amount_excl_btw?: number | null
          amount_incl_btw?: number
          btw_amount?: number | null
          btw_percentage?: number | null
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          updated_at?: string
          user_id?: string
          vendor_name?: string
        }
        Relationships: []
      }
      external_feeds: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          label_id: string | null
          last_synced_at: string | null
          name: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          label_id?: string | null
          last_synced_at?: string | null
          name: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          label_id?: string | null
          last_synced_at?: string | null
          name?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_feeds_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          btw_amount: number
          btw_percentage: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number | null
          subtotal: number
          total: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          btw_amount: number
          btw_percentage?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number | null
          subtotal: number
          total: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          btw_amount?: number
          btw_percentage?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number | null
          subtotal?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_address: string | null
          client_btw_number: string | null
          client_city: string | null
          client_company_name: string | null
          client_contact_name: string | null
          client_country: string | null
          client_id: string | null
          client_kvk_number: string | null
          client_postal_code: string | null
          created_at: string
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          notes_title: string | null
          paid_at: string | null
          payment_reference: string | null
          status: string
          subtotal: number
          total: number
          total_btw: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_address?: string | null
          client_btw_number?: string | null
          client_city?: string | null
          client_company_name?: string | null
          client_contact_name?: string | null
          client_country?: string | null
          client_id?: string | null
          client_kvk_number?: string | null
          client_postal_code?: string | null
          created_at?: string
          due_date: string
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          notes_title?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          status?: string
          subtotal?: number
          total?: number
          total_btw?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_address?: string | null
          client_btw_number?: string | null
          client_city?: string | null
          client_company_name?: string | null
          client_contact_name?: string | null
          client_country?: string | null
          client_id?: string | null
          client_kvk_number?: string | null
          client_postal_code?: string | null
          created_at?: string
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          notes_title?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          status?: string
          subtotal?: number
          total?: number
          total_btw?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          is_system: boolean | null
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          btw_number: string | null
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_name: string | null
          company_postal_code: string | null
          created_at: string
          default_hourly_rate: number | null
          default_payment_terms: number | null
          iban: string | null
          id: string
          kvk_number: string | null
          logo_url: string | null
          updated_at: string
          use_company_branding: boolean | null
          user_id: string
        }
        Insert: {
          btw_number?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          created_at?: string
          default_hourly_rate?: number | null
          default_payment_terms?: number | null
          iban?: string | null
          id?: string
          kvk_number?: string | null
          logo_url?: string | null
          updated_at?: string
          use_company_branding?: boolean | null
          user_id: string
        }
        Update: {
          btw_number?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          created_at?: string
          default_hourly_rate?: number | null
          default_payment_terms?: number | null
          iban?: string | null
          id?: string
          kvk_number?: string | null
          logo_url?: string | null
          updated_at?: string
          use_company_branding?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          hourly_rate: number | null
          id: string
          name: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          name: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          description: string | null
          hours: number
          id: string
          project_id: string
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hours: number
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
          work_date?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
