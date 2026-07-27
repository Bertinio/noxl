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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      configurations: {
        Row: {
          area_m2: number | null
          created_at: string
          height_mm: number | null
          id: string
          option_name: string
          option_value: string | null
          product_id: string | null
          project_id: string
          quantity: number
          total_price: number
          unit: string
          unit_price: number
          width_mm: number | null
        }
        Insert: {
          area_m2?: number | null
          created_at?: string
          height_mm?: number | null
          id?: string
          option_name: string
          option_value?: string | null
          product_id?: string | null
          project_id: string
          quantity?: number
          total_price?: number
          unit?: string
          unit_price?: number
          width_mm?: number | null
        }
        Update: {
          area_m2?: number | null
          created_at?: string
          height_mm?: number | null
          id?: string
          option_name?: string
          option_value?: string | null
          product_id?: string | null
          project_id?: string
          quantity?: number
          total_price?: number
          unit?: string
          unit_price?: number
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "configurations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configurations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          auth_user_id: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      installer_settings: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          name: string | null
          terms: string | null
          unit_price: number
          updated_at: string
          user_id: string
          vat_number: string | null
          vat_rate: number
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          name?: string | null
          terms?: string | null
          unit_price?: number
          updated_at?: string
          user_id: string
          vat_number?: string | null
          vat_rate?: number
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          name?: string | null
          terms?: string | null
          unit_price?: number
          updated_at?: string
          user_id?: string
          vat_number?: string | null
          vat_rate?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      project_quote_items: {
        Row: {
          area_m2: number | null
          created_at: string
          description: string
          height_mm: number | null
          id: string
          product_id: string | null
          quantity: number
          quote_id: string
          total_price: number
          unit: string
          unit_price: number
          width_mm: number | null
        }
        Insert: {
          area_m2?: number | null
          created_at?: string
          description: string
          height_mm?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          quote_id: string
          total_price?: number
          unit?: string
          unit_price?: number
          width_mm?: number | null
        }
        Update: {
          area_m2?: number | null
          created_at?: string
          description?: string
          height_mm?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          quote_id?: string
          total_price?: number
          unit?: string
          unit_price?: number
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "project_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      project_quotes: {
        Row: {
          created_at: string
          id: string
          last_email_sent_at: string | null
          project_id: string
          quote_number: string
          total_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_email_sent_at?: string | null
          project_id: string
          quote_number?: string
          total_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_email_sent_at?: string | null
          project_id?: string
          quote_number?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          id: string
          status: string
          title: string
          total_price: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          status?: string
          title: string
          total_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          status?: string
          title?: string
          total_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          area_m2: number | null
          created_at: string
          height_mm: number
          id: string
          notes: string | null
          position: number
          product_type: string
          quote_id: string
          total_ex_vat: number | null
          unit_price: number
          width_mm: number
        }
        Insert: {
          area_m2?: number | null
          created_at?: string
          height_mm: number
          id?: string
          notes?: string | null
          position?: number
          product_type: string
          quote_id: string
          total_ex_vat?: number | null
          unit_price: number
          width_mm: number
        }
        Update: {
          area_m2?: number | null
          created_at?: string
          height_mm?: number
          id?: string
          notes?: string | null
          position?: number
          product_type?: string
          quote_id?: string
          total_ex_vat?: number | null
          unit_price?: number
          width_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          id: string
          notes: string | null
          quote_number: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name: string
          id?: string
          notes?: string | null
          quote_number?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          id?: string
          notes?: string | null
          quote_number?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_quote_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer" | "installer"
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
    Enums: {
      app_role: ["admin", "customer", "installer"],
    },
  },
} as const
