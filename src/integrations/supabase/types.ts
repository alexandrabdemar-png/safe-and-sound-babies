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
      caregiver_access: {
        Row: {
          caregiver_user_id: string
          child_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          caregiver_user_id: string
          child_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          caregiver_user_id?: string
          child_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_access_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_completions: {
        Row: {
          created_at: string
          id: string
          item_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          user_id?: string
        }
        Relationships: []
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
          due_date: string | null
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
          due_date?: string | null
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
          due_date?: string | null
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
      completed_tips: {
        Row: {
          child_id: string | null
          created_at: string | null
          id: string
          tip_id: string
          user_id: string
          week_key: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          id?: string
          tip_id: string
          user_id: string
          week_key: string
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          id?: string
          tip_id?: string
          user_id?: string
          week_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "completed_tips_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          relationship: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
          relationship?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          relationship?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_info: {
        Row: {
          allergies: string | null
          blood_type: string | null
          child_id: string
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          medications: string | null
          notes: string | null
          pediatrician_name: string | null
          pediatrician_phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string | null
          blood_type?: string | null
          child_id: string
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          medications?: string | null
          notes?: string | null
          pediatrician_name?: string | null
          pediatrician_phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergies?: string | null
          blood_type?: string | null
          child_id?: string
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          medications?: string | null
          notes?: string | null
          pediatrician_name?: string | null
          pediatrician_phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_info_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_share_links: {
        Row: {
          child_id: string
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_share_links_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      home_profile: {
        Row: {
          created_at: string | null
          dismissed_at: string | null
          has_car: boolean | null
          has_pet: boolean | null
          has_pool: boolean | null
          has_stairs: boolean | null
          home_type: string | null
          id: string
          in_daycare: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dismissed_at?: string | null
          has_car?: boolean | null
          has_pet?: boolean | null
          has_pool?: boolean | null
          has_stairs?: boolean | null
          home_type?: string | null
          id?: string
          in_daycare?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dismissed_at?: string | null
          has_car?: boolean | null
          has_pet?: boolean | null
          has_pool?: boolean | null
          has_stairs?: boolean | null
          home_type?: string | null
          id?: string
          in_daycare?: string | null
          updated_at?: string | null
          user_id?: string
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
      lifecycle_alerts: {
        Row: {
          created_at: string
          id: string
          notification_channel: string | null
          notified_at: string | null
          product_id: string
          urgency: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_channel?: string | null
          notified_at?: string | null
          product_id: string
          urgency: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_channel?: string | null
          notified_at?: string | null
          product_id?: string
          urgency?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          photo_url: string | null
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
          photo_url?: string | null
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
          photo_url?: string | null
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
      product_catalog: {
        Row: {
          barcode: string
          brand: string | null
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          is_baby_product: boolean
          name: string | null
          raw: Json | null
          source: string
          updated_at: string
        }
        Insert: {
          barcode: string
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_baby_product?: boolean
          name?: string | null
          raw?: Json | null
          source: string
          updated_at?: string
        }
        Update: {
          barcode?: string
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_baby_product?: boolean
          name?: string | null
          raw?: Json | null
          source?: string
          updated_at?: string
        }
        Relationships: []
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
          notified_content_hash: string | null
          product_id: string
          recall_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          notified_content_hash?: string | null
          product_id: string
          recall_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          notified_content_hash?: string | null
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
          expiration_date: string | null
          id: string
          manufacture_date: string | null
          model: string | null
          name: string
          next_size_at: string | null
          notes: string | null
          photo_url: string | null
          predicted_replacement_date: string | null
          predicted_sizeup_date: string | null
          product_type: string
          purchased_at: string | null
          recall_checked_at: string | null
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
          expiration_date?: string | null
          id?: string
          manufacture_date?: string | null
          model?: string | null
          name: string
          next_size_at?: string | null
          notes?: string | null
          photo_url?: string | null
          predicted_replacement_date?: string | null
          predicted_sizeup_date?: string | null
          product_type?: string
          purchased_at?: string | null
          recall_checked_at?: string | null
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
          expiration_date?: string | null
          id?: string
          manufacture_date?: string | null
          model?: string | null
          name?: string
          next_size_at?: string | null
          notes?: string | null
          photo_url?: string | null
          predicted_replacement_date?: string | null
          predicted_sizeup_date?: string | null
          product_type?: string
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
          apns_device_token: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apns_device_token?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apns_device_token?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recall_source_status: {
        Row: {
          consecutive_failures: number
          last_attempt_at: string | null
          last_error: string | null
          last_success_at: string | null
          matches_last_run: number | null
          records_last_run: number | null
          source: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          matches_last_run?: number | null
          records_last_run?: number | null
          source: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          matches_last_run?: number | null
          records_last_run?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      recalls: {
        Row: {
          affected_date_end: string | null
          affected_date_start: string | null
          brand: string | null
          category: string | null
          content_hash: string | null
          created_at: string
          description: string | null
          hazard: string | null
          hazard_fingerprint: string | null
          id: string
          image_url: string | null
          model: string | null
          official: boolean
          product_name: string | null
          recall_date: string | null
          remedy: string | null
          severity_tier: string | null
          source: string
          source_id: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          affected_date_end?: string | null
          affected_date_start?: string | null
          brand?: string | null
          category?: string | null
          content_hash?: string | null
          created_at?: string
          description?: string | null
          hazard?: string | null
          hazard_fingerprint?: string | null
          id?: string
          image_url?: string | null
          model?: string | null
          official?: boolean
          product_name?: string | null
          recall_date?: string | null
          remedy?: string | null
          severity_tier?: string | null
          source?: string
          source_id?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          affected_date_end?: string | null
          affected_date_start?: string | null
          brand?: string | null
          category?: string | null
          content_hash?: string | null
          created_at?: string
          description?: string | null
          hazard?: string | null
          hazard_fingerprint?: string | null
          id?: string
          image_url?: string | null
          model?: string | null
          official?: boolean
          product_name?: string | null
          recall_date?: string | null
          remedy?: string | null
          severity_tier?: string | null
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
      recall_brand_coverage: {
        Row: {
          brand_lower: string | null
          earliest_recall_date: string | null
          latest_recall_date: string | null
          sources_seen: number | null
          total_recalls: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_milestones_for_child: {
        Args: { p_child_id: string; p_dob: string }
        Returns: undefined
      }
      has_child_access: {
        Args: { p_child_id: string; p_min_role?: string }
        Returns: boolean
      }
      has_product_access: {
        Args: { p_min_role?: string; p_product_id: string }
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
