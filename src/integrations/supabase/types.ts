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
      bottles: {
        Row: {
          alert_minutes_before: number
          bottle_type: string
          child_id: string | null
          created_at: string
          expires_at: string
          finished_at: string | null
          id: string
          notes: string | null
          notified_at: string | null
          ounces: number | null
          started_at: string
          storage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_minutes_before?: number
          bottle_type: string
          child_id?: string | null
          created_at?: string
          expires_at: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          ounces?: number | null
          started_at?: string
          storage: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_minutes_before?: number
          bottle_type?: string
          child_id?: string | null
          created_at?: string
          expires_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          ounces?: number | null
          started_at?: string
          storage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bottles_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      child_measurements: {
        Row: {
          child_id: string
          created_at: string
          height_inches: number | null
          id: string
          recorded_at: string
          user_id: string
          weight_lbs: number | null
        }
        Insert: {
          child_id: string
          created_at?: string
          height_inches?: number | null
          id?: string
          recorded_at?: string
          user_id: string
          weight_lbs?: number | null
        }
        Update: {
          child_id?: string
          created_at?: string
          height_inches?: number | null
          id?: string
          recorded_at?: string
          user_id?: string
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "child_measurements_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          birth_week: number | null
          created_at: string
          date_of_birth: string | null
          height_inches: number | null
          id: string
          measurements_updated_at: string | null
          name: string
          updated_at: string
          user_id: string
          weight_lbs: number | null
        }
        Insert: {
          birth_week?: number | null
          created_at?: string
          date_of_birth?: string | null
          height_inches?: number | null
          id?: string
          measurements_updated_at?: string | null
          name: string
          updated_at?: string
          user_id: string
          weight_lbs?: number | null
        }
        Update: {
          birth_week?: number | null
          created_at?: string
          date_of_birth?: string | null
          height_inches?: number | null
          id?: string
          measurements_updated_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
          weight_lbs?: number | null
        }
        Relationships: []
      }
      insight_dismissals: {
        Row: {
          action: string
          child_id: string | null
          created_at: string
          id: string
          rule_id: string
          until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          child_id?: string | null
          created_at?: string
          id?: string
          rule_id: string
          until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          child_id?: string | null
          created_at?: string
          id?: string
          rule_id?: string
          until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_dismissals_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          category: string | null
          child_id: string
          completed: boolean
          created_at: string
          due_date: string | null
          id: string
          logged_at: string
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          child_id: string
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          child_id?: string
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      product_alerts: {
        Row: {
          alert_type: string
          body: string | null
          child_id: string | null
          created_at: string
          id: string
          product_id: string
          read_at: string | null
          sent_at: string
          title: string
          user_id: string
        }
        Insert: {
          alert_type: string
          body?: string | null
          child_id?: string | null
          created_at?: string
          id?: string
          product_id: string
          read_at?: string | null
          sent_at?: string
          title: string
          user_id: string
        }
        Update: {
          alert_type?: string
          body?: string | null
          child_id?: string | null
          created_at?: string
          id?: string
          product_id?: string
          read_at?: string | null
          sent_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_alerts_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_guidelines: {
        Row: {
          average_use_months: number | null
          category: string | null
          created_at: string
          id: string
          max_height_inches: number | null
          max_weight_lbs: number | null
          min_height_inches: number | null
          min_weight_lbs: number | null
          product_id: string
          recall_check_needed: boolean
          replacement_interval_months: number | null
          replacement_trigger: string | null
          size_up_trigger: string | null
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_use_months?: number | null
          category?: string | null
          created_at?: string
          id?: string
          max_height_inches?: number | null
          max_weight_lbs?: number | null
          min_height_inches?: number | null
          min_weight_lbs?: number | null
          product_id: string
          recall_check_needed?: boolean
          replacement_interval_months?: number | null
          replacement_trigger?: string | null
          size_up_trigger?: string | null
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_use_months?: number | null
          category?: string | null
          created_at?: string
          id?: string
          max_height_inches?: number | null
          max_weight_lbs?: number | null
          min_height_inches?: number | null
          min_weight_lbs?: number | null
          product_id?: string
          recall_check_needed?: boolean
          replacement_interval_months?: number | null
          replacement_trigger?: string | null
          size_up_trigger?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_guidelines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recalls: {
        Row: {
          acknowledged: boolean
          created_at: string
          id: string
          product_id: string
          recall_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          product_id: string
          recall_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          product_id?: string
          recall_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recalls_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recalls_recall_id_fkey"
            columns: ["recall_id"]
            isOneToOne: false
            referencedRelation: "recalls"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          added_at: string
          barcode: string | null
          brand: string | null
          category: string | null
          child_id: string | null
          created_at: string
          id: string
          model: string | null
          name: string
          next_size_at: string | null
          notes: string | null
          predicted_replacement_date: string | null
          predicted_sizeup_date: string | null
          purchased_at: string | null
          recalled: boolean
          replace_at: string | null
          size: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          barcode?: string | null
          brand?: string | null
          category?: string | null
          child_id?: string | null
          created_at?: string
          id?: string
          model?: string | null
          name: string
          next_size_at?: string | null
          notes?: string | null
          predicted_replacement_date?: string | null
          predicted_sizeup_date?: string | null
          purchased_at?: string | null
          recalled?: boolean
          replace_at?: string | null
          size?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          barcode?: string | null
          brand?: string | null
          category?: string | null
          child_id?: string | null
          created_at?: string
          id?: string
          model?: string | null
          name?: string
          next_size_at?: string | null
          notes?: string | null
          predicted_replacement_date?: string | null
          predicted_sizeup_date?: string | null
          purchased_at?: string | null
          recalled?: boolean
          replace_at?: string | null
          size?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          expo_push_token: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          expo_push_token?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          expo_push_token?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recalls: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string
          description: string | null
          hazard: string | null
          id: string
          image_url: string | null
          product_name: string | null
          recall_date: string | null
          remedy: string | null
          source: string
          source_id: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          hazard?: string | null
          id?: string
          image_url?: string | null
          product_name?: string | null
          recall_date?: string | null
          remedy?: string | null
          source?: string
          source_id?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          hazard?: string | null
          id?: string
          image_url?: string | null
          product_name?: string | null
          recall_date?: string | null
          remedy?: string | null
          source?: string
          source_id?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          plan: string | null
          price_id: string | null
          product_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          plan?: string | null
          price_id?: string | null
          product_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          plan?: string | null
          price_id?: string | null
          product_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
