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
      material_suppliers: {
        Row: {
          is_primary: boolean
          linked: boolean
          material_id: string
          notes: string
          supplier_id: string
          user_id: string
        }
        Insert: {
          is_primary?: boolean
          linked?: boolean
          material_id: string
          notes?: string
          supplier_id: string
          user_id: string
        }
        Update: {
          is_primary?: boolean
          linked?: boolean
          material_id?: string
          notes?: string
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_suppliers_user_id_material_id_fkey"
            columns: ["user_id", "material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "material_suppliers_user_id_supplier_id_fkey"
            columns: ["user_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["user_id", "id"]
          },
        ]
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
      packaging: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          depth: number | null
          description: string
          dimension_unit: string
          height: number | null
          id: string
          last_stock_at: string | null
          material: string
          minimum: number
          name: string
          notes: string
          photo: string
          purchase_price: number
          purchase_quantity: number
          stock_balance: number
          updated_at: string
          use_unit: string
          user_id: string
          width: number | null
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          created_at?: string
          depth?: number | null
          description?: string
          dimension_unit?: string
          height?: number | null
          id?: string
          last_stock_at?: string | null
          material?: string
          minimum?: number
          name: string
          notes?: string
          photo?: string
          purchase_price: number
          purchase_quantity: number
          stock_balance?: number
          updated_at?: string
          use_unit: string
          user_id?: string
          width?: number | null
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          depth?: number | null
          description?: string
          dimension_unit?: string
          height?: number | null
          id?: string
          last_stock_at?: string | null
          material?: string
          minimum?: number
          name?: string
          notes?: string
          photo?: string
          purchase_price?: number
          purchase_quantity?: number
          stock_balance?: number
          updated_at?: string
          use_unit?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "packaging_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "packaging_categories"
            referencedColumns: ["name"]
          },
        ]
      }
      packaging_categories: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      packaging_stock_movements: {
        Row: {
          kind: string
          movement_date: string
          new_balance: number
          notes: string
          operation_id: string
          packaging_id: string
          previous_balance: number
          quantity: number
          reason: string
          recorded_at: string
          responsible: string
          unit: string
          user_id: string
        }
        Insert: {
          kind: string
          movement_date: string
          new_balance: number
          notes: string
          operation_id: string
          packaging_id: string
          previous_balance: number
          quantity: number
          reason: string
          recorded_at: string
          responsible: string
          unit: string
          user_id: string
        }
        Update: {
          kind?: string
          movement_date?: string
          new_balance?: number
          notes?: string
          operation_id?: string
          packaging_id?: string
          previous_balance?: number
          quantity?: number
          reason?: string
          recorded_at?: string
          responsible?: string
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packaging_stock_movements_user_id_packaging_id_fkey"
            columns: ["user_id", "packaging_id"]
            isOneToOne: false
            referencedRelation: "packaging"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      product_packaging: {
        Row: {
          packaging_id: string
          product_id: string
          quantity: number
          unit: string
          user_id: string
        }
        Insert: {
          packaging_id: string
          product_id: string
          quantity: number
          unit: string
          user_id: string
        }
        Update: {
          packaging_id?: string
          product_id?: string
          quantity?: number
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_packaging_user_id_packaging_id_unit_fkey"
            columns: ["user_id", "packaging_id", "unit"]
            isOneToOne: false
            referencedRelation: "packaging"
            referencedColumns: ["user_id", "id", "use_unit"]
          },
          {
            foreignKeyName: "product_packaging_user_id_product_id_fkey"
            columns: ["user_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["user_id", "id"]
          },
        ]
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
          ingredient_cost: number | null
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
          ingredient_cost?: number | null
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
          ingredient_cost?: number | null
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
          recipe_sheet_id: string | null
          units_per_presentation: number | null
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
          recipe_sheet_id?: string | null
          units_per_presentation?: number | null
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
          recipe_sheet_id?: string | null
          units_per_presentation?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_recipe_sheet_fkey"
            columns: ["user_id", "recipe_sheet_id"]
            isOneToOne: false
            referencedRelation: "recipe_sheets"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      recipe_sheet_versions: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          recipe_sheet_id: string
          snapshot: Json
          user_id: string
          version: number
        }
        Insert: {
          action: string
          changed_at: string
          changed_by?: string | null
          recipe_sheet_id: string
          snapshot: Json
          user_id: string
          version: number
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          recipe_sheet_id?: string
          snapshot?: Json
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_sheet_versions_user_id_recipe_sheet_id_fkey"
            columns: ["user_id", "recipe_sheet_id"]
            isOneToOne: false
            referencedRelation: "recipe_sheets"
            referencedColumns: ["user_id", "id"]
          },
        ]
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
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
      supplier_quotes: {
        Row: {
          id: number
          material_id: string
          package_price: number
          package_quantity: number
          quoted_on: string
          recorded_at: string
          recorded_by: string
          supplier_id: string
          unit: string
          user_id: string
        }
        Insert: {
          id?: never
          material_id: string
          package_price: number
          package_quantity: number
          quoted_on: string
          recorded_at?: string
          recorded_by: string
          supplier_id: string
          unit: string
          user_id: string
        }
        Update: {
          id?: never
          material_id?: string
          package_price?: number
          package_quantity?: number
          quoted_on?: string
          recorded_at?: string
          recorded_by?: string
          supplier_id?: string
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotes_user_id_material_id_supplier_id_fkey"
            columns: ["user_id", "material_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "material_suppliers"
            referencedColumns: ["user_id", "material_id", "supplier_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string
          address_number: string
          city: string
          code: number
          complement: string
          contact: string
          created_at: string
          district: string
          document: string
          email: string
          id: string
          name: string
          notes: string
          person_type: string
          phone: string
          postal_code: string
          state: string
          trade_name: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          active?: boolean
          address?: string
          address_number?: string
          city?: string
          code?: never
          complement?: string
          contact?: string
          created_at?: string
          district?: string
          document?: string
          email?: string
          id?: string
          name: string
          notes?: string
          person_type: string
          phone?: string
          postal_code?: string
          state?: string
          trade_name?: string
          updated_at?: string
          user_id: string
          whatsapp?: string
        }
        Update: {
          active?: boolean
          address?: string
          address_number?: string
          city?: string
          code?: never
          complement?: string
          contact?: string
          created_at?: string
          district?: string
          document?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          person_type?: string
          phone?: string
          postal_code?: string
          state?: string
          trade_name?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      material_supplier_details: { Args: { p_material: string }; Returns: Json }
      move_packaging_stock: {
        Args: {
          p_date: string
          p_expected: number
          p_item: string
          p_kind: string
          p_notes: string
          p_operation: string
          p_quantity: number
          p_reason: string
          p_unit: string
        }
        Returns: undefined
      }
      read_business_data: { Args: never; Returns: Json }
      read_product_packaging: { Args: { p_product: string }; Returns: Json }
      save_business_data: {
        Args: { expected_revision: number; payload: Json }
        Returns: number
      }
      save_material_supplier: {
        Args: {
          p_action: string
          p_date?: string
          p_material: string
          p_notes?: string
          p_price?: number
          p_quantity?: number
          p_supplier: string
          p_unit?: string
        }
        Returns: undefined
      }
      save_product_packaging: {
        Args: { p_expected: Json; p_items: Json; p_product: string }
        Returns: undefined
      }
      valid_supplier_document: {
        Args: { doc: string; kind: string }
        Returns: boolean
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
