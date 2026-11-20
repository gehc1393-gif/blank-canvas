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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      business_revisions: {
        Row: {
          created_at: string
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          id: string
          spentAt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description: string
          id: string
          spentAt: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          spentAt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          created_at: string
          id: string
          minimum: number
          name: string
          quantity: number
          unit: string
          unitCost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          minimum?: number
          name: string
          quantity?: number
          unit: string
          unitCost?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          minimum?: number
          name?: string
          quantity?: number
          unit?: string
          unitCost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_prices: {
        Row: {
          created_at: string
          price: number
          productId: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          price: number
          productId: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          price?: number
          productId?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_user_id_productId_fkey"
            columns: ["user_id", "productId"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      productions: {
        Row: {
          batches: number
          created_at: string
          createdAt: string
          id: string
          productId: string
          units: number
          updated_at: string
          user_id: string
        }
        Insert: {
          batches: number
          created_at?: string
          createdAt?: string
          id: string
          productId: string
          units: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          batches?: number
          created_at?: string
          createdAt?: string
          id?: string
          productId?: string
          units?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "productions_user_id_productId_fkey"
            columns: ["user_id", "productId"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      products: {
        Row: {
          batchYield: number
          created_at: string
          createdAt: string
          id: string
          name: string
          producedUnits: number
          recipe: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          batchYield: number
          created_at?: string
          createdAt?: string
          id: string
          name: string
          producedUnits?: number
          recipe?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          batchYield?: number
          created_at?: string
          createdAt?: string
          id?: string
          name?: string
          producedUnits?: number
          recipe?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe_sheets: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          description: string
          id: string
          ingredients: Json
          instructions: string
          name: string
          notes: string
          oven_minutes: number | null
          oven_temperature_c: number | null
          prep_minutes: number | null
          unit_weight_grams: number | null
          updated_at: string
          user_id: string
          yield_units: number
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          created_at?: string
          description?: string
          id?: string
          ingredients?: Json
          instructions?: string
          name: string
          notes?: string
          oven_minutes?: number | null
          oven_temperature_c?: number | null
          prep_minutes?: number | null
          unit_weight_grams?: number | null
          updated_at?: string
          user_id: string
          yield_units: number
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          description?: string
          id?: string
          ingredients?: Json
          instructions?: string
          name?: string
          notes?: string
          oven_minutes?: number | null
          oven_temperature_c?: number | null
          prep_minutes?: number | null
          unit_weight_grams?: number | null
          updated_at?: string
          user_id?: string
          yield_units?: number
        }
        Relationships: []
      }
      sales: {
        Row: {
          created_at: string
          id: string
          productId: string
          quantity: number
          soldAt: string
          unitCost: number
          unitPrice: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          productId: string
          quantity: number
          soldAt?: string
          unitCost: number
          unitPrice: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          productId?: string
          quantity?: number
          soldAt?: string
          unitCost?: number
          unitPrice?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_user_id_productId_fkey"
            columns: ["user_id", "productId"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          createdAt: string
          id: string
          kind: string
          materialId: string
          note: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          createdAt?: string
          id: string
          kind: string
          materialId: string
          note?: string
          quantity: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          createdAt?: string
          id?: string
          kind?: string
          materialId?: string
          note?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_user_id_materialId_fkey"
            columns: ["user_id", "materialId"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      read_business_data: { Args: never; Returns: Json }
      save_business_data: {
        Args: { expected_revision: number; payload: Json }
        Returns: number
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
