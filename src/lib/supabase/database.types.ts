export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      booth_sales: {
        Row: {
          candidates: Json | null
          category: Database["public"]["Enums"]["category"]
          created_at: string
          embedded_at: string | null
          embedding: string | null
          id: string
          matched_rank: number | null
          matched_variant_id: string | null
          note: string | null
          photo_main_path: string
          photo_thumb_path: string
          price_paid_cents: number | null
          reconciled_at: string | null
          sold_on: string
          status: Database["public"]["Enums"]["booth_sale_status"]
          variant_label: string
        }
        Insert: {
          candidates?: Json | null
          category: Database["public"]["Enums"]["category"]
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          id?: string
          matched_rank?: number | null
          matched_variant_id?: string | null
          note?: string | null
          photo_main_path: string
          photo_thumb_path: string
          price_paid_cents?: number | null
          reconciled_at?: string | null
          sold_on?: string
          status?: Database["public"]["Enums"]["booth_sale_status"]
          variant_label: string
        }
        Update: {
          candidates?: Json | null
          category?: Database["public"]["Enums"]["category"]
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          id?: string
          matched_rank?: number | null
          matched_variant_id?: string | null
          note?: string | null
          photo_main_path?: string
          photo_thumb_path?: string
          price_paid_cents?: number | null
          reconciled_at?: string | null
          sold_on?: string
          status?: Database["public"]["Enums"]["booth_sale_status"]
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "booth_sales_matched_variant_id_fkey"
            columns: ["matched_variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      design_images: {
        Row: {
          design_id: string
          id: string
          main_image_path: string
          sort_order: number
          thumb_image_path: string
        }
        Insert: {
          design_id: string
          id?: string
          main_image_path: string
          sort_order?: number
          thumb_image_path: string
        }
        Update: {
          design_id?: string
          id?: string
          main_image_path?: string
          sort_order?: number
          thumb_image_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_images_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_images_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "public_designs"
            referencedColumns: ["id"]
          },
        ]
      }
      designs: {
        Row: {
          category: Database["public"]["Enums"]["category"]
          created_at: string
          description_en: string | null
          description_fr: string | null
          dimensions: string | null
          embedded_at: string | null
          embedding: string | null
          id: string
          main_image_path: string | null
          material_en: string | null
          material_fr: string | null
          name_en: string
          name_fr: string | null
          previous_slugs: string[]
          price_cents: number
          slug: string
          status: Database["public"]["Enums"]["design_status"]
          thumb_image_path: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["category"]
          created_at?: string
          description_en?: string | null
          description_fr?: string | null
          dimensions?: string | null
          embedded_at?: string | null
          embedding?: string | null
          id?: string
          main_image_path?: string | null
          material_en?: string | null
          material_fr?: string | null
          name_en: string
          name_fr?: string | null
          previous_slugs?: string[]
          price_cents: number
          slug: string
          status?: Database["public"]["Enums"]["design_status"]
          thumb_image_path?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["category"]
          created_at?: string
          description_en?: string | null
          description_fr?: string | null
          dimensions?: string | null
          embedded_at?: string | null
          embedding?: string | null
          id?: string
          main_image_path?: string | null
          material_en?: string | null
          material_fr?: string | null
          name_en?: string
          name_fr?: string | null
          previous_slugs?: string[]
          price_cents?: number
          slug?: string
          status?: Database["public"]["Enums"]["design_status"]
          thumb_image_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          delta: number
          id: string
          note: string | null
          reason: Database["public"]["Enums"]["movement_reason"]
          ref_id: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          reason: Database["public"]["Enums"]["movement_reason"]
          ref_id?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          reason?: Database["public"]["Enums"]["movement_reason"]
          ref_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          design_id: string | null
          fulfilled: boolean
          id: string
          name_snapshot: string
          order_id: string
          qty: number
          unit_price_cents: number
          variant_id: string | null
          variant_label_snapshot: string
        }
        Insert: {
          design_id?: string | null
          fulfilled?: boolean
          id?: string
          name_snapshot: string
          order_id: string
          qty: number
          unit_price_cents: number
          variant_id?: string | null
          variant_label_snapshot: string
        }
        Update: {
          design_id?: string | null
          fulfilled?: boolean
          id?: string
          name_snapshot?: string
          order_id?: string
          qty?: number
          unit_price_cents?: number
          variant_id?: string | null
          variant_label_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "public_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string | null
          customer_phone: string | null
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          locale: string
          picked_up_at: string | null
          refunded_at: string | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cents: number
          status: Database["public"]["Enums"]["order_status"]
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name?: string | null
          customer_phone?: string | null
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          locale?: string
          picked_up_at?: string | null
          refunded_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents?: number
          status: Database["public"]["Enums"]["order_status"]
          stripe_checkout_session_id: string
          stripe_payment_intent_id?: string | null
          subtotal_cents: number
          tax_cents?: number
          total_cents: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          customer_phone?: string | null
          fulfillment?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          locale?: string
          picked_up_at?: string | null
          refunded_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          stripe_checkout_session_id?: string
          stripe_payment_intent_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          free_shipping_threshold_cents: number | null
          id: number
          market_address: string | null
          market_close_time: string | null
          market_closed_note_en: string | null
          market_closed_note_fr: string | null
          market_closed_until: string | null
          market_name: string | null
          market_open_time: string | null
          market_timezone: string
          market_weekday: number | null
          pickup_instructions_en: string | null
          pickup_instructions_fr: string | null
          shipping_enabled: boolean
          shipping_flat_cents: number
          stripe_tax_enabled: boolean
          updated_at: string
          variant_presets: Json
        }
        Insert: {
          free_shipping_threshold_cents?: number | null
          id: number
          market_address?: string | null
          market_close_time?: string | null
          market_closed_note_en?: string | null
          market_closed_note_fr?: string | null
          market_closed_until?: string | null
          market_name?: string | null
          market_open_time?: string | null
          market_timezone?: string
          market_weekday?: number | null
          pickup_instructions_en?: string | null
          pickup_instructions_fr?: string | null
          shipping_enabled?: boolean
          shipping_flat_cents?: number
          stripe_tax_enabled?: boolean
          updated_at?: string
          variant_presets: Json
        }
        Update: {
          free_shipping_threshold_cents?: number | null
          id?: number
          market_address?: string | null
          market_close_time?: string | null
          market_closed_note_en?: string | null
          market_closed_note_fr?: string | null
          market_closed_until?: string | null
          market_name?: string | null
          market_open_time?: string | null
          market_timezone?: string
          market_weekday?: number | null
          pickup_instructions_en?: string | null
          pickup_instructions_fr?: string | null
          shipping_enabled?: boolean
          shipping_flat_cents?: number
          stripe_tax_enabled?: boolean
          updated_at?: string
          variant_presets?: Json
        }
        Relationships: []
      }
      variants: {
        Row: {
          design_id: string
          id: string
          label: string
          qty_on_hand: number
          sort_order: number
        }
        Insert: {
          design_id: string
          id?: string
          label: string
          qty_on_hand?: number
          sort_order?: number
        }
        Update: {
          design_id?: string
          id?: string
          label?: string
          qty_on_hand?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "variants_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variants_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "public_designs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_designs: {
        Row: {
          category: Database["public"]["Enums"]["category"] | null
          created_at: string | null
          description_en: string | null
          description_fr: string | null
          dimensions: string | null
          id: string | null
          main_image_path: string | null
          material_en: string | null
          material_fr: string | null
          name_en: string | null
          name_fr: string | null
          price_cents: number | null
          slug: string | null
          status: Database["public"]["Enums"]["design_status"] | null
          thumb_image_path: string | null
          total_qty: number | null
          updated_at: string | null
          variants: Json | null
        }
        Relationships: []
      }
      public_settings: {
        Row: {
          free_shipping_threshold_cents: number | null
          market_address: string | null
          market_close_time: string | null
          market_closed_note_en: string | null
          market_closed_note_fr: string | null
          market_closed_until: string | null
          market_name: string | null
          market_open_time: string | null
          market_timezone: string | null
          market_weekday: number | null
          pickup_instructions_en: string | null
          pickup_instructions_fr: string | null
          shipping_enabled: boolean | null
          shipping_flat_cents: number | null
          stripe_tax_enabled: boolean | null
          variant_presets: Json | null
        }
        Insert: {
          free_shipping_threshold_cents?: number | null
          market_address?: string | null
          market_close_time?: string | null
          market_closed_note_en?: string | null
          market_closed_note_fr?: string | null
          market_closed_until?: string | null
          market_name?: string | null
          market_open_time?: string | null
          market_timezone?: string | null
          market_weekday?: number | null
          pickup_instructions_en?: string | null
          pickup_instructions_fr?: string | null
          shipping_enabled?: boolean | null
          shipping_flat_cents?: number | null
          stripe_tax_enabled?: boolean | null
          variant_presets?: Json | null
        }
        Update: {
          free_shipping_threshold_cents?: number | null
          market_address?: string | null
          market_close_time?: string | null
          market_closed_note_en?: string | null
          market_closed_note_fr?: string | null
          market_closed_until?: string | null
          market_name?: string | null
          market_open_time?: string | null
          market_timezone?: string | null
          market_weekday?: number | null
          pickup_instructions_en?: string | null
          pickup_instructions_fr?: string | null
          shipping_enabled?: boolean | null
          shipping_flat_cents?: number | null
          stripe_tax_enabled?: boolean | null
          variant_presets?: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_inventory: {
        Args: {
          p_delta: number
          p_note?: string
          p_reason: Database["public"]["Enums"]["movement_reason"]
          p_ref_id?: string
          p_variant_id: string
        }
        Returns: number
      }
      bulk_restock: {
        Args: { p_design_ids: string[]; p_note?: string; p_qty: number }
        Returns: number
      }
      design_is_published: { Args: { p_design_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      match_designs: {
        Args: {
          match_count?: number
          p_category?: Database["public"]["Enums"]["category"]
          query_embedding: string
        }
        Returns: {
          design_id: string
          distance: number
        }[]
      }
      next_market_date: { Args: never; Returns: string }
    }
    Enums: {
      booth_sale_status: "pending" | "matched" | "unmatched" | "oversold"
      category:
        | "necklace"
        | "bracelet"
        | "anklet"
        | "ring"
        | "earring"
        | "bangle"
        | "chain"
        | "pendant"
      design_status: "draft" | "active" | "archived"
      fulfillment_type: "ship" | "pickup"
      movement_reason:
        | "catalog"
        | "restock"
        | "adjustment"
        | "online_order"
        | "booth_sale"
        | "refund"
        | "reconcile_undo"
      order_status:
        | "paid"
        | "awaiting_pickup"
        | "picked_up"
        | "awaiting_shipment"
        | "shipped"
        | "refunded"
        | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booth_sale_status: ["pending", "matched", "unmatched", "oversold"],
      category: [
        "necklace",
        "bracelet",
        "anklet",
        "ring",
        "earring",
        "bangle",
        "chain",
        "pendant",
      ],
      design_status: ["draft", "active", "archived"],
      fulfillment_type: ["ship", "pickup"],
      movement_reason: [
        "catalog",
        "restock",
        "adjustment",
        "online_order",
        "booth_sale",
        "refund",
        "reconcile_undo",
      ],
      order_status: [
        "paid",
        "awaiting_pickup",
        "picked_up",
        "awaiting_shipment",
        "shipped",
        "refunded",
        "cancelled",
      ],
    },
  },
} as const

