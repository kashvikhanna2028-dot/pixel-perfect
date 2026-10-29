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
      entitlements: {
        Row: {
          pro_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          pro_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          pro_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          id: string
          notification_key: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_key: string
          read_at?: string
          user_id?: string
        }
        Update: {
          id?: string
          notification_key?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          currency: string
          id: string
          plan: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          currency?: string
          id?: string
          plan: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          currency?: string
          id?: string
          plan?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_currency: string
          display_name: string
          email_reminders_enabled: boolean
          renewal_reminder_days: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          display_name?: string
          email_reminders_enabled?: boolean
          renewal_reminder_days?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          display_name?: string
          email_reminders_enabled?: boolean
          renewal_reminder_days?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_deliveries: {
        Row: {
          billing_date: string
          id: string
          kind: string
          sent_at: string | null
          subscription_id: string
          user_id: string
        }
        Insert: {
          billing_date: string
          id?: string
          kind: string
          sent_at?: string | null
          subscription_id: string
          user_id: string
        }
        Update: {
          billing_date?: string
          id?: string
          kind?: string
          sent_at?: string | null
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_ratings: {
        Row: {
          created_at: string
          id: string
          month: string
          rating: number
          subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          rating: number
          subscription_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          rating?: number
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_ratings_subscription_id_user_id_fkey"
            columns: ["subscription_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          billing_cycle: string
          cancel_url: string
          category: string
          created_at: string
          currency: string
          custom_days: number | null
          id: string
          is_trial: boolean
          name: string
          next_billing_date: string
          notes: string
          payment_method: string
          price: number
          shared_with: number
          start_date: string
          status: string
          trial_ends_on: string | null
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          billing_cycle: string
          cancel_url?: string
          category: string
          created_at?: string
          currency?: string
          custom_days?: number | null
          id?: string
          is_trial?: boolean
          name: string
          next_billing_date: string
          notes?: string
          payment_method?: string
          price: number
          shared_with?: number
          start_date: string
          status?: string
          trial_ends_on?: string | null
          user_id?: string
        }
        Update: {
          auto_renew?: boolean
          billing_cycle?: string
          cancel_url?: string
          category?: string
          created_at?: string
          currency?: string
          custom_days?: number | null
          id?: string
          is_trial?: boolean
          name?: string
          next_billing_date?: string
          notes?: string
          payment_method?: string
          price?: number
          shared_with?: number
          start_date?: string
          status?: string
          trial_ends_on?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trackers: {
        Row: {
          category: string
          cost_value: number | null
          created_at: string
          expires_at: string | null
          id: string
          name: string
          next_reset_at: string | null
          notes: string
          reset_day: number | null
          reset_time: string
          reset_type: string
          timezone: string
          total_amount: number
          unit: string
          used_amount: number
          user_id: string
        }
        Insert: {
          category: string
          cost_value?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          name: string
          next_reset_at?: string | null
          notes?: string
          reset_day?: number | null
          reset_time?: string
          reset_type: string
          timezone?: string
          total_amount: number
          unit?: string
          used_amount?: number
          user_id: string
        }
        Update: {
          category?: string
          cost_value?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          name?: string
          next_reset_at?: string | null
          notes?: string
          reset_day?: number | null
          reset_time?: string
          reset_type?: string
          timezone?: string
          total_amount?: number
          unit?: string
          used_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          amount: number
          external_key: string | null
          id: string
          logged_at: string
          tracker_id: string
          user_id: string
        }
        Insert: {
          amount: number
          external_key?: string | null
          id?: string
          logged_at?: string
          tracker_id: string
          user_id: string
        }
        Update: {
          amount?: number
          external_key?: string | null
          id?: string
          logged_at?: string
          tracker_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trackers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_external_usage_reading: {
        Args: {
          p_tracker_id: string
          p_used_amount: number
          p_external_key: string
        }
        Returns: Json
      }
      advance_subscription_date: {
        Args: { anchor: string; cycle: string; d: string; days: number }
        Returns: string
      }
      mark_subscription_renewed: {
        Args: { expected_date: string; subscription: string }
        Returns: undefined
      }
      roll_subscription_renewals: { Args: never; Returns: undefined }
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
